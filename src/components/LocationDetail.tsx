"use client";

import { useState } from "react";
import {
  X,
  Clock,
  Tag,
  Lightbulb,
  Star,
  Navigation,
  ThumbsUp,
} from "lucide-react";
import type { CampusLocation } from "@/lib/types";
import { categoryMeta } from "@/lib/types";
import { RatingStars, averageRating } from "./RatingStars";

export default function LocationDetail({
  location,
  onClose,
  onAddReview,
}: {
  location: CampusLocation;
  onClose: () => void;
  onAddReview: (locationId: string, review: Omit<CampusLocation["reviews"][number], "id">) => void;
}) {
  const meta = categoryMeta(location.category);
  const avg = averageRating(location.reviews);
  const tips = location.reviews.filter((r) => r.tip);
  const [formOpen, setFormOpen] = useState(false);
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState("");
  const [voted, setVoted] = useState<Set<string>>(new Set());

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.position[0]},${location.position[1]}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !comment.trim()) return;
    onAddReview(location.id, {
      author: author.trim(),
      rating,
      comment: comment.trim(),
      tip: tip.trim() || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setAuthor("");
    setComment("");
    setTip("");
    setRating(5);
    setFormOpen(false);
  }

  function toggleVote(reviewId: string) {
    setVoted((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  }

  return (
    <div className="absolute inset-y-0 right-0 z-[1000] flex w-96 max-w-full flex-col bg-white shadow-2xl">
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: meta.color }}
            >
              {meta.label}
            </span>
            <h2 className="mt-1.5 text-base font-bold text-gray-900">
              {location.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {avg > 0 ? (
            <>
              <RatingStars value={avg} />
              <span className="text-sm text-gray-600">
                {avg.toFixed(1)} · {location.reviews.length} review
                {location.reviews.length !== 1 && "s"}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">No reviews yet</span>
          )}
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-gray-600">
          <p>{location.description}</p>
          <p className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            {location.hours}
          </p>
          {location.tags.length > 0 && (
            <p className="flex flex-wrap items-center gap-1">
              <Tag size={14} className="text-gray-400" />
              {location.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                >
                  {t}
                </span>
              ))}
            </p>
          )}
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Navigation size={14} />
          Get Directions
        </a>
      </div>

      {tips.length > 0 && (
        <div className="border-b border-gray-100 bg-amber-50 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Lightbulb size={15} />
            Senior Tips
          </h3>
          <ul className="mt-2 space-y-2">
            {tips.map((r) => (
              <li key={r.id} className="text-sm text-amber-900/80">
                <span className="font-medium">{r.author}:</span> {r.tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Reviews</h3>
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700"
          >
            {formOpen ? "Cancel" : "Write a review"}
          </button>
        </div>

        {formOpen && (
          <form onSubmit={submit} className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name & year (e.g. Sara, 2nd yr CSE)"
              className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  aria-label={`Rate ${i} stars`}
                >
                  <Star
                    size={18}
                    className={
                      i <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    }
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was this place?"
              rows={2}
              className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <input
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="Optional tip for fellow students…"
              className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Post Review
            </button>
          </form>
        )}

        <ul className="space-y-3">
          {location.reviews.length === 0 && (
            <li className="text-sm text-gray-400">
              Be the first to review this place.
            </li>
          )}
          {location.reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{r.author}</span>
                <RatingStars value={r.rating} size={12} />
              </div>
              <p className="mt-1 text-sm text-gray-600">{r.comment}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">{r.createdAt}</span>
                <button
                  onClick={() => toggleVote(r.id)}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition ${
                    voted.has(r.id)
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <ThumbsUp size={12} />
                  Helpful{voted.has(r.id) ? " ✓" : ""}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
