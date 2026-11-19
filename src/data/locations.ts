import type { CampusLocation } from "@/lib/types";

/**
 * Egypt-Japan University of Science and Technology (E-JUST)
 * New Borg El-Arab City, Alexandria, Egypt
 *
 * Campus center (OSM/Wikidata): 30.8585°N, 29.5645°E
 * Layout follows the Nikken Sekkei / Isozaki master plan:
 * Japanese Garden at the center, Central Library and Research
 * Buildings around it, Admin to the east, Lecture Halls to the
 * north, Main Gate to the south. Dorms + Activities Hub + food
 * courts form the residential/2nd campus area to the east.
 *
 * Building coordinates are approximate placements based on the
 * published campus master plan — adjust once surveyed.
 */
export const CAMPUS_CENTER: [number, number] = [30.8585, 29.5645];

export const LOCATIONS: CampusLocation[] = [
  {
    id: "main-gate",
    name: "Main Gate & Security",
    category: "admin",
    description:
      "South entrance to the academic campus on the Symbolic Axis. Access-controlled; visitors must register with security. Shuttles to the residential area stop outside the gate.",
    position: [30.8568, 29.5645],
    hours: "Open 24/7",
    tags: ["security", "shuttle-stop", "visitor-registration"],
    reviews: [
      {
        id: "r-gate-1",
        author: "Yara (3rd yr, EECE)",
        rating: 4,
        comment:
          "Security is strict but polite. Always carry your student ID — they check it every time.",
        tip: "The shuttle to the dorms comes every ~20 min until midnight; after that, coordinate with friends.",
        createdAt: "2026-09-14",
      },
    ],
  },
  {
    id: "admin-building",
    name: "Administration Building",
    category: "admin",
    description:
      "University administration offices east of the Japanese Garden. Houses the President's office, finance, and general inquiries desk.",
    position: [30.8582, 29.5654],
    hours: "Sun–Thu 09:00–15:00",
    tags: ["finance", "official-business", "inquiries"],
    reviews: [
      {
        id: "r-admin-1",
        author: "Mostafa (4th yr, ME)",
        rating: 3,
        comment:
          "Standard government-office energy. Get any scholarship or payment paperwork started early — everything takes a few days.",
        createdAt: "2026-08-30",
      },
    ],
  },
  {
    id: "student-affairs",
    name: "Student Affairs Office",
    category: "admin",
    description:
      "Handles enrollment letters, course add/drop issues, grievance filings, leave requests, and student ID replacement.",
    position: [30.8583, 29.5652],
    hours: "Sun–Thu 09:00–14:00",
    tags: ["grievances", "enrollment", "id-cards"],
    reviews: [
      {
        id: "r-sa-1",
        author: "Habiba (2nd yr, CSE)",
        rating: 4,
        comment:
          "Staff here are surprisingly helpful compared to other admin offices. They explained the whole leave-request process to me.",
        tip: "Bring two printed copies of every form. The printer on the ground floor runs out at peak times.",
        createdAt: "2026-09-21",
      },
      {
        id: "r-sa-2",
        author: "Student (1st yr, ARCH)",
        rating: 3,
        comment: "Busy around add/drop week. Go right at 09:00 if you can.",
        createdAt: "2026-09-08",
      },
    ],
  },
  {
    id: "medical-clinic",
    name: "Medical Clinic",
    category: "admin",
    description:
      "24/7 medical clinic near the residential area. Free consultations for enrolled students, emergency care, and basic pharmacy.",
    position: [30.8579, 29.5692],
    hours: "Open 24/7",
    tags: ["24/7", "free-for-students", "emergency"],
    reviews: [
      {
        id: "r-med-1",
        author: "Ziad (3rd yr, ENE)",
        rating: 5,
        comment:
          "Went at 2am with a fever — seen in 15 minutes, no charge. Genuinely one of the best things about living on campus.",
        createdAt: "2026-10-02",
      },
    ],
  },
  {
    id: "central-library",
    name: "H.E. Ambassador Faiza Abu El-Naga Central Library",
    category: "library",
    description:
      "The university's central library at the heart of campus, facing the Japanese Garden. Four floors of print collections, digital databases (IEEE, ScienceDirect), bookable group study rooms, and printing services.",
    position: [30.8588, 29.5646],
    hours: "Sun–Thu 08:00–20:00, Sat 10:00–16:00",
    tags: ["study-rooms", "printing", "databases", "wifi"],
    reviews: [
      {
        id: "r-lib-1",
        author: "Malak (4th yr, CSE)",
        rating: 5,
        comment:
          "The group study rooms on floor 2 are the best spot on campus for project sessions. Book them through the library portal, not in person.",
        tip: "Ground-floor printers jam a lot — use the floor-3 printers near the east stairwell.",
        createdAt: "2026-09-19",
      },
      {
        id: "r-lib-2",
        author: "Tarek (2nd yr, ME)",
        rating: 4,
        comment:
          "Great databases for papers (IEEE, ScienceDirect). WiFi is strong everywhere except the basement stacks.",
        createdAt: "2026-09-25",
      },
    ],
  },
  {
    id: "silent-study",
    name: "Silent Study Floors — Library",
    category: "quiet-study",
    description:
      "Upper floors of the Central Library are strictly silent individual study zones. Power at every desk, natural light on the garden side. No group work allowed.",
    position: [30.8589, 29.5644],
    hours: "Sun–Thu 08:00–20:00",
    tags: ["silent", "outlets", "exam-season"],
    reviews: [
      {
        id: "r-silent-1",
        author: "Ahmed (4th yr, EECE)",
        rating: 5,
        comment:
          "The only place on campus where I can fully focus during midterms. Staff enforce silence properly.",
        tip: "Fills up by 09:00 in exam season. Garden-side desks have the best light in the afternoon.",
        createdAt: "2026-10-01",
      },
      {
        id: "r-silent-2",
        author: "Nour (2nd yr, SCI)",
        rating: 4,
        comment: "Perfect for solo work. A bit cold in winter — bring a hoodie.",
        createdAt: "2026-10-06",
      },
    ],
  },
  {
    id: "lecture-halls",
    name: "Main Lecture Halls",
    category: "lecture-hall",
    description:
      "North of the library on the academic spine. Tiered lecture halls used for first- and second-year courses across all departments (ECCE, IDE, EECE, Sciences). Smart boards and lecture recording in most halls.",
    position: [30.8596, 29.5642],
    hours: "Sun–Thu 08:00–17:00",
    tags: ["smart-board", "recorded-lectures", "tiered"],
    reviews: [
      {
        id: "r-lh-1",
        author: "Salma (2nd yr, CSE)",
        rating: 4,
        comment:
          "Recorded lectures are a lifesaver when you miss a session. Halls fill fast for required math courses.",
        tip: "Halls B1–B3 have the best AC. The back rows in the big hall have weak mic pickup — sit mid-hall.",
        createdAt: "2026-09-16",
      },
      {
        id: "r-lh-2",
        author: "Karim (1st yr, ARCH)",
        rating: 3,
        comment: "Fine halls, but the corridors get chaotic between back-to-back lectures.",
        createdAt: "2026-09-29",
      },
    ],
  },
  {
    id: "abe-complex",
    name: "Shinzo Abe Academic Complex",
    category: "lecture-hall",
    description:
      "The new academic complex named after former Japanese PM Shinzo Abe, in recognition of Japan's role in founding EJUST. Houses 14 buildings for the university's colleges and academic programs, planned with Egyptian professors and Japanese experts from 13 partner universities.",
    position: [30.8591, 29.5656],
    hours: "Sun–Thu 08:00–17:00",
    tags: ["new-buildings", "colleges", "smart-classrooms"],
    reviews: [
      {
        id: "r-abe-1",
        author: "Habiba (2nd yr, CSE)",
        rating: 5,
        comment:
          "The new buildings are on another level — better AC, actual power outlets in class, and proper labs for CS & IT courses.",
        tip: "Some departments are still moving in; check which building your course moved to before rushing across campus.",
        createdAt: "2026-10-07",
      },
    ],
  },
  {
    id: "smart-classrooms",
    name: "Smart Classrooms Building",
    category: "lecture-hall",
    description:
      "Interactive multimedia classrooms with smart boards, used for department courses, seminars, and make-up sessions. Smaller rooms, easier to ask questions.",
    position: [30.8593, 29.565],
    hours: "Sun–Thu 08:00–17:00",
    tags: ["seminars", "small-groups", "interactive"],
    reviews: [
      {
        id: "r-smart-1",
        author: "Laila (3rd yr, ENE)",
        rating: 5,
        comment:
          "Much better than the big halls for department courses. Professors actually notice when you're lost.",
        createdAt: "2026-09-11",
      },
    ],
  },
  {
    id: "coe-labs",
    name: "Ahmed El-Gohary Center for Excellence in Research",
    category: "lab",
    description:
      "Flagship research building west of the Japanese Garden, named after EJUST's former president. Core laboratories for materials science, physics, chemistry, electronics, and communications — part of the 50+ labs across campus.",
    position: [30.8586, 29.5632],
    hours: "Sun–Thu 09:00–17:00 (lab sections by schedule)",
    tags: ["research", "materials-science", "open-day-tours"],
    reviews: [
      {
        id: "r-coe-1",
        author: "Mostafa (4th yr, CSE)",
        rating: 4,
        comment:
          "Serious equipment for a university this size — they showed visiting students the electron microscope on Open Campus. Access is by course schedule or research registration.",
        tip: "Ask your TA about open-lab hours; they're not advertised anywhere.",
        createdAt: "2026-09-27",
      },
    ],
  },
  {
    id: "building-8",
    name: "Building 8 — Solar Chimney Labs",
    category: "lab",
    description:
      "Teaching and research building featuring the campus's famous solar chimney passive-cooling system. Used for energy, environment, and architecture labs and studios.",
    position: [30.859, 29.5628],
    hours: "Sun–Thu 09:00–17:00",
    tags: ["solar-chimney", "sustainable-design", "architecture"],
    reviews: [
      {
        id: "r-b8-1",
        author: "Dina (3rd yr, ARCH)",
        rating: 5,
        comment:
          "Studios here are a dream — you literally study inside a sustainability case study. The solar chimney actually keeps the lower floors cool.",
        tip: "Roof access for the chimney tour is granted during Open Day; ask the facilities office for other visits.",
        createdAt: "2026-09-22",
      },
    ],
  },
  {
    id: "japanese-garden",
    name: "Japanese Garden",
    category: "quiet-study",
    description:
      "The green heart of the campus, designed in the Nikken master plan. Ponds, shaded paths, and benches — a favorite spot for reading, language exchanges, and decompressing between lectures.",
    position: [30.8585, 29.5645],
    hours: "Open daily, lit until ~22:00",
    tags: ["outdoor", "ponds", "photo-spot", "group-friendly"],
    reviews: [
      {
        id: "r-jg-1",
        author: "Habiba (3rd yr, CSE)",
        rating: 5,
        comment:
          "Best study spot in winter semester. The benches near the pond stay shaded all afternoon.",
        tip: "Too hot May–September at midday, but golden hour here is perfect.",
        createdAt: "2026-03-04",
      },
      {
        id: "r-jg-2",
        author: "Youssef (1st yr, ME)",
        rating: 5,
        comment: "I bring my Japanese language homework here. Feels right.",
        createdAt: "2026-10-03",
      },
    ],
  },
  {
    id: "wetland-ponds",
    name: "Wetland Ponds Walk",
    category: "quiet-study",
    description:
      "Semi-wetland water treatment system north of the academic buildings — native aquatic plants naturally treat wastewater. Walking path with benches; used for environmental science fieldwork.",
    position: [30.8602, 29.564],
    hours: "Open daily",
    tags: ["nature", "sustainability", "walking"],
    reviews: [
      {
        id: "r-wet-1",
        author: "Laila (3rd yr, ENE)",
        rating: 4,
        comment:
          "Underrated. Nice for a clear-head walk between lectures, and it shows up in half our sustainability lectures.",
        createdAt: "2026-09-30",
      },
    ],
  },
  {
    id: "coffee-shop",
    name: "Campus Coffee Shop",
    category: "cafeteria",
    description:
      "Coffee and snacks near the library and garden. Laptop-friendly, decent WiFi, and the unofficial meeting point for study groups.",
    position: [30.8587, 29.5649],
    hours: "Sun–Thu 08:00–18:00",
    tags: ["coffee", "wifi", "study-groups"],
    reviews: [
      {
        id: "r-coffee-1",
        author: "Ziad (3rd yr, ME)",
        rating: 4,
        comment:
          "Slightly pricier than the food court but the quiet makes up for it. My default spot for group meetings.",
        tip: "Ask about the prepaid card — it adds up to ~10% savings over the semester.",
        createdAt: "2026-09-18",
      },
    ],
  },
  {
    id: "main-food-court",
    name: "Main Food Court",
    category: "cafeteria",
    description:
      "One of 4 food courts on campus. Hot meals, sandwiches, and drinks at student prices. Indoor seating plus shaded outdoor tables.",
    position: [30.8578, 29.5668],
    hours: "Sun–Thu 07:30–16:00",
    tags: ["cheap", "outdoor-seating", "busy"],
    reviews: [
      {
        id: "r-fc-1",
        author: "Karim (4th yr, EECE)",
        rating: 4,
        comment: "Best value on campus. The sandwich station is quick even at noon rush.",
        tip: "Peak is 12:30–13:15. Eat at 12:00 or after 13:30 and you'll walk right up.",
        createdAt: "2026-09-20",
      },
      {
        id: "r-fc-2",
        author: "Nour (2nd yr, SCI)",
        rating: 3,
        comment: "Decent food, but tables get messy after noon. The far-right tables stay cleaner.",
        createdAt: "2026-10-04",
      },
    ],
  },
  {
    id: "japanese-restaurant",
    name: "Japanese Restaurant",
    category: "cafeteria",
    description:
      "Campus Japanese restaurant — ramen, sushi, and bento at student-friendly prices. A nod to the university's Japanese partnership and a favorite for cultural events.",
    position: [30.8576, 29.5671],
    hours: "Sun–Thu 11:30–16:00",
    tags: ["ramen", "sushi", "cultural"],
    reviews: [
      {
        id: "r-jr-1",
        author: "Malak (4th yr, CSE)",
        rating: 5,
        comment:
          "The ramen is legitimately good and the staff are students who actually know the menu. Busy on Japan-related event days.",
        tip: "Sunday lunch has the shortest queue.",
        createdAt: "2026-09-26",
      },
    ],
  },
  {
    id: "activities-hub",
    name: "Student Activities Building (Activities Hub)",
    category: "sports",
    description:
      "Main student activities and sports building: heated Olympic-size swimming pool, squash court, fully equipped gymnasium, and locker rooms. Also hosts student clubs and activities. Free or discounted access for enrolled students.",
    position: [30.8574, 29.5675],
    hours: "Sun–Thu 09:00–20:00 (women's slots mornings, men's evenings — check schedule)",
    tags: ["pool", "gym", "squash", "clubs"],
    reviews: [
      {
        id: "r-hub-1",
        author: "Ahmed (4th yr, EECE)",
        rating: 5,
        comment:
          "A heated indoor pool in the middle of the desert is not something you expect. Gym gets crowded 17:00–19:00.",
        tip: "Bring your own padlock for the lockers — they don't provide them.",
        createdAt: "2026-09-15",
      },
      {
        id: "r-hub-2",
        author: "Dina (3rd yr, ARCH)",
        rating: 4,
        comment: "Squash courts are great but book ahead; they vanish by Wednesday.",
        createdAt: "2026-09-28",
      },
    ],
  },
  {
    id: "football-fields",
    name: "Football Fields & Outdoor Courts",
    category: "sports",
    description:
      "Four football fields plus tennis and multi-purpose courts on the eastern side of campus. Pickup games almost every evening in the winter semester.",
    position: [30.857, 29.5682],
    hours: "Open daily until sunset (lighted fields until ~21:00)",
    tags: ["football", "tennis", "pickup-games"],
    reviews: [
      {
        id: "r-ff-1",
        author: "Tarek (2nd yr, ME)",
        rating: 4,
        comment:
          "Fields are well maintained. Just bring your own ball — the shared ones are flat by midweek.",
        tip: "Faculty vs. student matches happen around sports week — sign up at the Hub.",
        createdAt: "2026-10-05",
      },
    ],
  },
  {
    id: "dormitories",
    name: "Student Dormitories",
    category: "housing",
    description:
      "Fully furnished air-conditioned rooms with high-speed WiFi, kitchenettes, laundry, TV lounges, and study areas. Access-controlled buildings with 24/7 supervision. Small/medium/large rooms, some with private bathrooms.",
    position: [30.8578, 29.5695],
    hours: "Residents: 24/7 access · Quiet hours enforced",
    tags: ["wifi", "furnished", "laundry", "24/7-security"],
    reviews: [
      {
        id: "r-dorm-1",
        author: "Salma (2nd yr, CSE)",
        rating: 4,
        comment:
          "Living on campus saves the 1-hour+ commute from Alexandria. Rooms are small but everything works.",
        tip: "Apply for housing the day admissions open — the good room types go fast.",
        createdAt: "2026-09-10",
      },
      {
        id: "r-dorm-2",
        author: "Youssef (1st yr, ME)",
        rating: 4,
        comment:
          "Kitchenettes make a huge difference vs. regular dorms. Laundry queue on Sunday evenings is brutal though.",
        createdAt: "2026-09-23",
      },
    ],
  },
  {
    id: "services-zone",
    name: "Campus Services — Bank, Post Office & Pharmacy",
    category: "admin",
    description:
      "Public services zone for students and staff: university bank branch, post office, pharmacy, and real estate registry desk — so you rarely need to leave campus for daily errands.",
    position: [30.8576, 29.5665],
    hours: "Sun–Thu 09:00–14:00",
    tags: ["bank", "post-office", "pharmacy"],
    reviews: [
      {
        id: "r-svc-1",
        author: "Ziad (3rd yr, ME)",
        rating: 4,
        comment:
          "The pharmacy is a lifesaver at night when you can't leave campus. Bank queue is longest at the start of the month.",
        tip: "The post office handles official document mailing — bring your ID and the reference number from Student Affairs.",
        createdAt: "2026-09-24",
      },
    ],
  },
  {
    id: "martial-arts-hall",
    name: "Japanese Martial Arts Hall",
    category: "sports",
    description:
      "Covered hall for Japanese martial arts (judo, kendo-style training) and defensive sports, reflecting the Japanese partnership. Used for PE courses and student clubs.",
    position: [30.8573, 29.5678],
    hours: "Sun–Thu 10:00–20:00 (club slots evenings)",
    tags: ["judo", "martial-arts", "pe-courses", "clubs"],
    reviews: [
      {
        id: "r-ma-1",
        author: "Karim (4th yr, EECE)",
        rating: 5,
        comment:
          "Joined the judo club second year — one of the most underrated spots on campus. Instructor is patient with total beginners.",
        tip: "PE martial arts courses fill fast; register in the first hour of the add period.",
        createdAt: "2026-10-08",
      },
    ],
  },
];
