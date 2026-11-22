"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Hash, MessageCircle, Pin, PinOff, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import {
  canDeleteMessage,
  canPinMessage,
  courseCodeToChannel,
  MAX_MESSAGE_LENGTH,
  normalizeChannelSlug,
  resolveChatRole,
  type ChatMessage,
} from "@/lib/chat-validation";
import { readGpa, readTimetableSnapshot } from "@/lib/student-data";
import { scopedStorageKey } from "@/lib/user-scoped-storage";

const POLL_MS = 3_500;
const CHAT_ROOMS_EVENT = "ejust:chat-rooms-change";

const CAMPUS_CHANNELS = [
  { slug: "general", labelKey: "chat.general" },
  { slug: "bus-commute", labelKey: "chat.busCommute" },
  { slug: "freshmen", labelKey: "chat.freshmen" },
  { slug: "study-groups", labelKey: "chat.studyGroups" },
] as const;

interface CourseRoom {
  slug: string;
  label: string;
}

interface MessagesResponse {
  channel: string;
  messages: ChatMessage[];
  pinned: ChatMessage[];
}

interface StorageUser {
  id?: string | null;
  email?: string | null;
}

interface ChatRoomsSnapshot {
  derived: CourseRoom[];
  joined: CourseRoom[];
}

const EMPTY_ROOMS_SNAPSHOT: ChatRoomsSnapshot = { derived: [], joined: [] };

function byCreatedAt(a: ChatMessage, b: ChatMessage): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function channelClass(active: boolean): string {
  return `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition ${
    active
      ? "bg-blue-50 font-semibold text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;
}

function readJoinedRooms(storageKey: string): CourseRoom[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const slugs = new Set<string>();
    for (const value of parsed) {
      const slug = normalizeChannelSlug(value);
      if (slug !== "general") slugs.add(slug);
    }
    return [...slugs].map((slug) => ({ slug, label: slug.toUpperCase() }));
  } catch {
    return [];
  }
}

function mergeRooms(...groups: CourseRoom[][]): CourseRoom[] {
  const rooms = new Map<string, CourseRoom>();
  for (const group of groups) {
    for (const room of group) {
      if (!rooms.has(room.slug)) rooms.set(room.slug, room);
    }
  }
  return [...rooms.values()];
}

function deriveCourseRooms(user: StorageUser): CourseRoom[] {
  const rooms = new Map<string, string>();
  const add = (code: unknown) => {
    if (typeof code !== "string") return;
    const slug = courseCodeToChannel(code);
    if (!slug || slug === "general") return;
    if (!rooms.has(slug)) rooms.set(slug, code.trim().toUpperCase());
  };

  readGpa(window.localStorage, user)?.courses.forEach((course) => add(course.code));
  const timetable = readTimetableSnapshot(window.localStorage, user);
  Object.values(timetable.schedules)
    .flat()
    .forEach((block) => add(block.courseCode));

  return [...rooms]
    .map(([slug, label]) => ({ slug, label: label || slug.toUpperCase() }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function ChatClient() {
  const { locale, t } = useLanguage();
  const { data: session, status } = useSession();

  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const storageUser = useMemo<StorageUser>(
    () => ({ id: userId, email: userEmail }),
    [userId, userEmail]
  );
  const roomsKey = useMemo(
    () => scopedStorageKey("chat-rooms", storageUser),
    [storageUser]
  );

  const roomsCacheRef = useRef<{ key: string; value: ChatRoomsSnapshot } | null>(null);
  const sessionJoinedRef = useRef<CourseRoom[]>([]);
  const getRoomsSnapshot = useCallback(() => {
    const derived = deriveCourseRooms(storageUser);
    const joined = mergeRooms(readJoinedRooms(roomsKey), sessionJoinedRef.current);
    const key = JSON.stringify([roomsKey, derived, joined]);
    if (roomsCacheRef.current?.key === key) return roomsCacheRef.current.value;
    const value: ChatRoomsSnapshot = { derived, joined };
    roomsCacheRef.current = { key, value };
    return value;
  }, [roomsKey, storageUser]);
  const subscribeRooms = useCallback((onStoreChange: () => void) => {
    const handler = () => onStoreChange();
    window.addEventListener("storage", handler);
    window.addEventListener(CHAT_ROOMS_EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(CHAT_ROOMS_EVENT, handler);
    };
  }, []);
  const roomsSnapshot = useSyncExternalStore(
    subscribeRooms,
    getRoomsSnapshot,
    () => EMPTY_ROOMS_SNAPSHOT
  );
  const derivedRooms = roomsSnapshot.derived;
  const joinedRooms = roomsSnapshot.joined;

  const isAuthenticated = status === "authenticated" && !!session?.user;
  const role = resolveChatRole(session?.user?.role, session?.user?.taStatus);
  const canPin = isAuthenticated && canPinMessage(role);
  const actor = session?.user ? { id: session.user.id, role } : null;
  const displayName = (
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Student"
  ).slice(0, 80);

  const [activeChannel, setActiveChannel] = useState("general");
  const activeChannelRef = useRef("general");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [courseInput, setCourseInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const allCourseRooms = useMemo(() => {
    const rooms = new Map<string, CourseRoom>();
    for (const room of [...derivedRooms, ...joinedRooms]) {
      rooms.set(room.slug, room);
    }
    return [...rooms.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [derivedRooms, joinedRooms]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "ja" ? "ja-JP" : locale === "ar" ? "ar-EG" : "en-US",
        { hour: "2-digit", minute: "2-digit" }
      ),
    [locale]
  );

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
  };

  const channelLabel = (slug: string) => {
    const campus = CAMPUS_CHANNELS.find((item) => item.slug === slug);
    return campus ? t(campus.labelKey) : `#${slug}`;
  };

  const scrollToBottom = useCallback((smooth = false) => {
    const element = feedRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = true;
    setHasNew(false);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadMessages = useCallback(
    async (mode: "initial" | "poll" | "manual") => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams({ channel: activeChannel, limit: "50" });
      const after = mode === "initial" ? null : cursorRef.current;
      if (after) params.set("after", after);

      try {
        // Keep effect-scheduled loads from setting state synchronously.
        await Promise.resolve();
        if (controller.signal.aborted) return;
        if (mode === "manual") setRefreshing(true);
        if (mode === "initial") setLoadState("loading");

        const response = await fetch(`/api/chat/messages?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as MessagesResponse;
        if (controller.signal.aborted || activeChannelRef.current !== activeChannel) return;

        const current = messagesRef.current;
        const knownIds = new Set(
          current.filter((message) => !message.pending).map((message) => message.id)
        );
        const incoming = data.messages.filter((message) => !knownIds.has(message.id));
        const pending = current.filter((message) => message.pending);
        const confirmedPending = new Set(
          pending
            .filter((item) =>
              incoming.some(
                (message) =>
                  message.userId === item.userId &&
                  message.content === item.content &&
                  Math.abs(Date.parse(message.createdAt) - Date.parse(item.createdAt)) < 10_000
              )
            )
            .map((item) => item.id)
        );
        const remainingPending = pending.filter((item) => !confirmedPending.has(item.id));

        if (mode === "initial") {
          cursorRef.current = data.messages.at(-1)?.createdAt ?? null;
          atBottomRef.current = true;
          setHasNew(false);
        } else if (incoming.length > 0) {
          cursorRef.current = data.messages.at(-1)?.createdAt ?? cursorRef.current;
          if (!atBottomRef.current) setHasNew(true);
        }

        setPinned(data.pinned);
        setMessages([
          ...[...current.filter((message) => !message.pending), ...incoming].sort(byCreatedAt),
          ...remainingPending,
        ]);
        setLoadState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setLoadState("error");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          inFlightRef.current = false;
        }
        if (mode === "manual") setRefreshing(false);
      }
    },
    [activeChannel]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void loadMessages("initial");
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadMessages("poll");
    }, POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) void loadMessages("poll");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadMessages]);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(true);
  }, [messages, scrollToBottom]);

  const selectChannel = (slug: string) => {
    const next = normalizeChannelSlug(slug);
    if (next === activeChannelRef.current) {
      setDrawerOpen(false);
      return;
    }
    abortRef.current?.abort();
    inFlightRef.current = false;
    cursorRef.current = null;
    messagesRef.current = [];
    atBottomRef.current = true;

    activeChannelRef.current = next;
    setActiveChannel(next);
    setMessages([]);
    setPinned([]);
    setHasNew(false);
    setDraft("");
    setLoadState("loading");
    setRefreshing(false);
    setDrawerOpen(false);
  };

  const refresh = () => {
    void loadMessages("manual");
  };

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = courseCodeToChannel(courseInput);
    if (!slug || slug === "general") {
      setNotice("chat.invalidCourse");
      return;
    }
    const room: CourseRoom = {
      slug,
      label: courseInput.trim().toUpperCase() || slug.toUpperCase(),
    };
    const next = mergeRooms(
      joinedRooms.filter((item) => item.slug !== slug),
      [room]
    );
    sessionJoinedRef.current = next;
    try {
      window.localStorage.setItem(roomsKey, JSON.stringify(next.map((item) => item.slug)));
    } catch {
      // Storage can be disabled; the room still works for this session.
    }
    window.dispatchEvent(new Event(CHAT_ROOMS_EVENT));
    setCourseInput("");
    selectChannel(slug);
  };

  const submitMessage = useCallback(async () => {
    const content = draft.replace(/\0/g, "").replace(/\r\n?/g, "\n").trim();
    if (!isAuthenticated || !content || sending) return;
    if (Array.from(content).length > MAX_MESSAGE_LENGTH) return;

    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      channel: activeChannel,
      userId: userId ?? "me",
      userName: displayName,
      userRole: role,
      content,
      isPinned: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setSending(true);
    atBottomRef.current = true;

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: activeChannel, content }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { message: ChatMessage };
      setMessages((current) =>
        current.map((message) => (message.id === tempId ? data.message : message))
      );
    } catch {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      setNotice("chat.sendError");
    } finally {
      setSending(false);
      scrollToBottom(true);
    }
  }, [activeChannel, displayName, draft, isAuthenticated, role, scrollToBottom, sending, userId]);

  const togglePin = async (message: ChatMessage) => {
    if (!canPin || message.pending) return;
    const next = !message.isPinned;
    try {
      const response = await fetch(`/api/chat/messages/${encodeURIComponent(message.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: next }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { message: ChatMessage };
      const updated = data.message;
      setPinned((current) =>
        next
          ? [updated, ...current.filter((item) => item.id !== updated.id)].slice(0, 1)
          : current.filter((item) => item.id !== updated.id)
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : next && item.isPinned
              ? { ...item, isPinned: false }
              : item
        )
      );
    } catch {
      setNotice("chat.moderationError");
    }
  };

  const removeMessage = async (message: ChatMessage) => {
    if (!actor || !canDeleteMessage(actor, message) || message.pending) return;
    if (!window.confirm(t("chat.deleteConfirm"))) return;
    try {
      const response = await fetch(`/api/chat/messages/${encodeURIComponent(message.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setPinned((current) => current.filter((item) => item.id !== message.id));
    } catch {
      setNotice("chat.moderationError");
    }
  };

  const handleScroll = () => {
    const element = feedRef.current;
    if (!element) return;
    atBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (atBottomRef.current) setHasNew(false);
  };

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[520px] flex-col gap-3 p-3 md:h-[calc(100dvh-3rem)] md:flex-row md:gap-4 md:p-4">
      <button
        type="button"
        aria-controls="chat-channels"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden"
      >
        <MessageCircle size={16} />
        {t("chat.channels")}
      </button>

      {drawerOpen && (
        <button
          type="button"
          aria-label={t("chat.hideDrawer")}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside
        id="chat-channels"
        aria-label={t("chat.channels")}
        className={`fixed inset-y-0 start-0 z-50 flex w-72 shrink-0 flex-col border-e border-gray-200 bg-white p-3 shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-950 md:static md:z-auto md:w-60 md:translate-x-0 md:shadow-none ${
          drawerOpen ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("chat.channels")}
          </h2>
          <button
            type="button"
            aria-label={t("chat.hideDrawer")}
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {t("chat.campusChannels")}
        </p>
        <div className="space-y-0.5">
          {CAMPUS_CHANNELS.map((channel) => (
            <button
              key={channel.slug}
              type="button"
              aria-current={activeChannel === channel.slug ? "page" : undefined}
              onClick={() => selectChannel(channel.slug)}
              className={channelClass(activeChannel === channel.slug)}
            >
              <Hash size={15} className="shrink-0 opacity-60" />
              <span className="truncate">{t(channel.labelKey)}</span>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("chat.myCourseRooms")}
          </p>
          <div className="max-h-52 space-y-0.5 overflow-y-auto">
            {allCourseRooms.map((room) => (
              <button
                key={room.slug}
                type="button"
                aria-current={activeChannel === room.slug ? "page" : undefined}
                onClick={() => selectChannel(room.slug)}
                className={channelClass(activeChannel === room.slug)}
              >
                <Hash size={15} className="shrink-0 opacity-60" />
                <span className="truncate">{room.label}</span>
              </button>
            ))}
          </div>
          <form onSubmit={joinRoom} className="mt-2 flex gap-1.5">
            <input
              value={courseInput}
              onChange={(event) => setCourseInput(event.target.value)}
              placeholder={t("chat.courseCode")}
              aria-label={t("chat.courseCode")}
              maxLength={32}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              aria-label={t("chat.joinRoom")}
              className="shrink-0 rounded-lg bg-gray-900 px-2.5 text-white transition hover:bg-gray-700 dark:bg-cyan-500 dark:hover:bg-cyan-400"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-slate-800">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {t("chat.title")}
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-slate-400">
              {channelLabel(activeChannel)} · {t("chat.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            aria-label={t("chat.refresh")}
            title={t("chat.refresh")}
            className="shrink-0 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </header>

        {notice && (
          <div
            role="status"
            className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {t(notice)}
          </div>
        )}

        {status === "unauthenticated" && (
          <div
            role="status"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200"
          >
            <span>{t("chat.guestBanner")}</span>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white transition hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400"
            >
              {t("chat.signIn")}
            </Link>
          </div>
        )}

        {pinned[0] && (
          <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
            <Pin size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {t("chat.pinned")}
              </p>
              <p className="max-h-14 overflow-hidden whitespace-pre-wrap break-words text-xs text-amber-900 dark:text-amber-100">
                {pinned[0].content}
              </p>
            </div>
            {canPin && (
              <button
                type="button"
                onClick={() => void togglePin(pinned[0])}
                aria-label={t("chat.unpin")}
                title={t("chat.unpin")}
                className="shrink-0 rounded-lg p-1.5 text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
              >
                <PinOff size={15} />
              </button>
            )}
          </div>
        )}

        <div
          ref={feedRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-label={channelLabel(activeChannel)}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          {loadState === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-slate-400">
              <RefreshCw size={15} className="animate-spin" />
              {t("chat.loading")}
            </div>
          )}
          {loadState === "error" && (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-gray-500 dark:text-slate-400">
              <span>{t("chat.error")}</span>
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t("chat.retry")}
              </button>
            </div>
          )}
          {loadState === "ready" && messages.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">
              {t("chat.empty")}
            </p>
          )}

          <ol className="space-y-2.5">
            {messages.map((message) => {
              const own = message.userId === userId;
              return (
                <li
                  key={message.id}
                  className={`rounded-xl border px-3 py-2 ${
                    own
                      ? "border-blue-200 bg-blue-50/70 dark:border-cyan-400/20 dark:bg-cyan-400/5"
                      : "border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900/50"
                  } ${message.pending ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-gray-800 dark:text-slate-100">
                        {message.userName}
                      </span>
                      {own && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                          {t("chat.you")}
                        </span>
                      )}
                      {message.userRole !== "STUDENT" && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            message.userRole === "ADMIN"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                          }`}
                        >
                          {t(message.userRole === "ADMIN" ? "chat.admin" : "chat.verifiedTa")}
                        </span>
                      )}
                    </div>
                    <time
                      dateTime={message.createdAt}
                      className="shrink-0 text-[10px] text-gray-400 dark:text-slate-500"
                    >
                      {formatTime(message.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-slate-200">
                    {message.content}
                    {message.pending && <span className="ms-1 opacity-60">…</span>}
                  </p>
                  {(canPin || (actor && canDeleteMessage(actor, message))) && !message.pending && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {canPin && (
                        <button
                          type="button"
                          onClick={() => void togglePin(message)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                        >
                          {message.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                          {message.isPinned ? t("chat.unpin") : t("chat.pin")}
                        </button>
                      )}
                      {actor && canDeleteMessage(actor, message) && (
                        <button
                          type="button"
                          onClick={() => void removeMessage(message)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 size={12} />
                          {t("chat.delete")}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {hasNew && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="mx-auto -mb-1 shrink-0 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white shadow-lg dark:bg-cyan-500"
          >
            {t("chat.newMessages")}
          </button>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage();
          }}
          className="shrink-0 border-t border-gray-200 px-3 py-2.5 dark:border-slate-800"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void submitMessage();
              }}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={!isAuthenticated || sending}
              placeholder={t("chat.messagePlaceholder", { channel: activeChannel })}
              aria-label={t("chat.messagePlaceholder", { channel: activeChannel })}
              className="min-w-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!isAuthenticated || sending || draft.trim().length === 0}
              aria-label={t("chat.send")}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500 dark:hover:bg-cyan-400"
            >
              <Send size={15} />
              <span className="hidden sm:inline">{t("chat.send")}</span>
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-400 dark:text-slate-500">
            <span className="truncate">{t("chat.keyboardHint")}</span>
            <span className="shrink-0" aria-live="polite">
              {t("chat.counter", { count: Array.from(draft).length })}
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}
