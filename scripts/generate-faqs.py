"""Generate bilingual synthetic E-JUST CSIT FAQs.

Requires OPENAI_API_KEY in the environment. The key is never written to disk.
"""

import asyncio
import json
import os
from pathlib import Path

from openai import AsyncOpenAI
from tqdm.asyncio import tqdm_asyncio

SYSTEM_PROMPT = """You are an expert AI Data Engineer and Academic Consultant for E-JUST,
specifically the Faculty of Computer Science & Information Technology (CSIT).
Generate accurate, diverse bilingual FAQ records using only these rules:
- Graduation: 134 credits and minimum CGPA 2.00/4.00.
- Progression: 32, 64, and 96 completed credits for Levels 2, 3, and 4.
- Programs: CSC, AID, CNC, and BIF.
- Building 7: daily CSIT lectures in F1.20-F1.24 and computer labs COE F2.16/F2.17.
- Building 10: major exams, Theater B10, Green, Blue, Yellow, and Red Halls.
- Housing curfew: 11:00 PM; visitors are restricted; maintenance uses the housing app/QR;
  laundry is on the ground floor.
- Transport: daily Alexandria shuttles to Smouha and Sidi Gaber; Cairo buses run Thursday/Sunday.
- Scholarships require minimum CGPA 3.00; fees are due by the end of Week 2.
Do not invent policies outside these facts. Return a JSON object with an "items" array.
Each item must contain id, category, question_ar, question_en, answer_ar, answer_en, keywords.
Categories: academic, housing, transport, fees, administrative, IT_services."""

TOPICS = [
    ("academic", "graduation requirements and the 134-credit curriculum"),
    ("academic", "level progression at 32, 64, and 96 credits"),
    ("academic", "Computer Science CSC program and required and elective courses"),
    ("academic", "Artificial Intelligence and Data Science AID program"),
    ("academic", "Computer Networks and Cyber Security CNC program and labs"),
    ("academic", "Bioinformatics BIF program and applications"),
    ("academic", "Half Load registration and advisor or medical approval"),
    ("academic", "course retakes, grade improvement, and CGPA"),
    ("academic", "Add/Drop period and SIS schedule changes"),
    ("academic", "Academic Probation and clearing a warning"),
    ("academic", "Summer Courses and the 6-7 credit limit"),
    ("academic", "medical excuses for missed exams and Incomplete grades"),
    ("academic", "Semester Freeze and enrollment postponement"),
    ("academic", "faculty and teaching assistant office hours"),
    ("housing", "11 PM dormitory curfew and penalties"),
    ("housing", "room maintenance and air conditioning through the housing app or QR"),
    ("housing", "ground-floor laundry rules and schedule"),
    ("housing", "visitor restrictions and shared-room policies"),
    ("housing", "housing deposit, check-in, and checkout"),
    ("transport", "daily Alexandria shuttles to Smouha and Sidi Gaber"),
    ("transport", "Thursday and Sunday Cairo weekend buses"),
    ("transport", "shuttle booking, cancellation, and transport subscriptions"),
    ("fees", "maintaining scholarships with CGPA 3.00 or higher"),
    ("fees", "tuition deadline by the end of Week 2 and late payment"),
    ("fees", "tuition installment plans and financial aid"),
    ("administrative", "replacement Student ID card"),
    ("administrative", "official transcript and enrollment certificate"),
    ("administrative", "military status delay Forms 2 and 3 for male Egyptian students"),
    ("administrative", "university health clinic services"),
    ("IT_services", "Moodle login and password reset"),
    ("IT_services", "official E-JUST email and Google Workspace on mobile"),
    ("IT_services", "EJUST-Student Wi-Fi on Android and iPhone using PEAP and MSCHAPv2"),
]

STYLES = [
    "short Egyptian Arabic student question",
    "formal Modern Standard Arabic question",
    "direct academic English question",
    "student question using common abbreviations such as GPA, SIS, Moodle, or Building 7",
]


async def generate_batch(
    client: AsyncOpenAI,
    semaphore: asyncio.Semaphore,
    batch_number: int,
    category: str,
    topic: str,
    style: str,
) -> list[dict]:
    async with semaphore:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Generate 8 unique non-repetitive FAQ records.\n"
                        f"Category: {category}\nSubtopics: {topic}\nStyle: {style}\n"
                        f"Batch number: {batch_number}"
                    ),
                },
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        payload = json.loads(content)
        if isinstance(payload, list):
            return payload
        items = payload.get("items", [])
        return items if isinstance(items, list) else []


async def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY before running this script.")

    client = AsyncOpenAI(api_key=api_key)
    semaphore = asyncio.Semaphore(5)
    tasks = [
        generate_batch(client, semaphore, index, category, topic, style)
        for index, (category, topic) in enumerate(TOPICS, start=1)
        for style in STYLES
    ]
    batches = await tqdm_asyncio.gather(*tasks)

    output: list[dict] = []
    seen: set[str] = set()
    for batch in batches:
        for item in batch:
            question = str(item.get("question_ar", "")).strip()
            if not question or question in seen:
                continue
            seen.add(question)
            output.append({**item, "id": f"faq_{len(output) + 1:04d}"})

    target = Path("src/data/faqs_1000.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(output)} unique FAQs at {target}")


if __name__ == "__main__":
    asyncio.run(main())
