import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), "data", "EJUST_Faculty.db");
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: "Faculty database not found" },
        { status: 404 }
      );
    }

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT * FROM faculty ORDER BY id").all();
    db.close();

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching faculty:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty data" },
      { status: 500 }
    );
  }
}
