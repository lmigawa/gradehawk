import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "node-xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const outputPath = path.join(projectRoot, "data", "courses.json");
const rawDataUrl =
  "https://raw.githubusercontent.com/acm-uiowa/uigrades/main/src/db/seeds/data/raw-course-data/";

const sourceFiles = [
  "AQidwai_UISG_Summer2023thruFall2023.xlsx",
  "MKjeldgaard_UISG_Winter2024thruSpring2025.xlsx",
  "MKjelgaard_UISG_Summer2025thruFall2025.xlsx",
  "QEldridge_UISG_Fall2022thruSpring2023.xlsx",
  "ZHemmen_UISG_Summer2024thruFall2024.xlsx",
  "ZHemmen_UISG_Winter2023thruSpring2024.xlsx",
];

const gradeColumns = {
  "+A-": "A",
  A_PLUS: "A+",
  A: "A",
  A_MINUS: "A-",
  "+B-": "B",
  B_PLUS: "B+",
  B: "B",
  B_MINUS: "B-",
  "+C-": "C",
  C_PLUS: "C+",
  C: "C",
  C_MINUS: "C-",
  "+D-_F": "D & F",
  D_PLUS: "D+",
  D: "D",
  D_MINUS: "D-",
  F: "F",
  WITHDRAWN: "W",
};

const gradeOrder = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "D & F",
  "F",
];

const gradePoints = {
  "A+": 4,
  A: 4,
  "A-": 3.67,
  "B+": 3.33,
  B: 3,
  "B-": 2.67,
  "C+": 2.33,
  C: 2,
  "C-": 1.67,
  "D+": 1.33,
  D: 1,
  "D-": 0.67,
  "D & F": 0.5,
  F: 0,
};
const modifiedGrades = new Set([
  "A+",
  "A-",
  "B+",
  "B-",
  "C+",
  "C-",
  "D+",
  "D-",
]);
const baseGrades = new Set(["A", "B", "C", "D", "D & F", "F"]);

function getSemester(sheetName) {
  const match = sheetName.match(/(Fall|Winter|Spring|Summer)(\d{4})/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function getCell(row, index) {
  return row[index] === undefined || row[index] === null
    ? ""
    : String(row[index]).trim();
}

function parseCourseCode(value) {
  const parts = value.split(":").map((part) => part.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return {
    courseCode: `${parts[0]}:${parts[1]}`,
    section: parts.slice(2).join(":"),
  };
}

function normalizeInstructor(value) {
  return value.split(/\s+-\s+/)[0].trim();
}

function normalizeGrades(headers, row) {
  const grades = {};
  headers.forEach((header, index) => {
    const category = gradeColumns[String(header).trim()];
    if (!category) {
      return;
    }

    const value = Number(row[index]);
    if (Number.isFinite(value)) {
      grades[category] = (grades[category] || 0) + value;
    }
  });
  return grades;
}

function summarizeGrades(grades) {
  const gradedEntries = gradeOrder
    .map((grade) => ({ grade, count: grades[grade] || 0 }))
    .filter((entry) => entry.count > 0);
  const totalGrades = gradedEntries.reduce((total, entry) => total + entry.count, 0);

  if (totalGrades === 0) {
    return { averageGrade: null, medianGrade: null };
  }

  const weightedPoints = gradedEntries.reduce(
    (total, entry) => total + gradePoints[entry.grade] * entry.count,
    0,
  );
  const averagePoints = weightedPoints / totalGrades;
  const hasModifiedGrades = gradedEntries.some(({ grade }) =>
    modifiedGrades.has(grade),
  );
  const availableGrades = gradeOrder.filter(
    (grade) => hasModifiedGrades || baseGrades.has(grade),
  );
  const averageGrade = availableGrades.reduce((closest, grade) =>
    Math.abs(gradePoints[grade] - averagePoints) <
    Math.abs(gradePoints[closest] - averagePoints)
      ? grade
      : closest,
  "F");

  const middle = (totalGrades - 1) / 2;
  let count = 0;
  let medianGrade = gradedEntries[gradedEntries.length - 1].grade;
  for (const entry of gradedEntries) {
    count += entry.count;
    if (count > middle) {
      medianGrade = entry.grade;
      break;
    }
  }

  return { averageGrade, medianGrade };
}

async function fetchWorkbook(fileName) {
  const response = await fetch(`${rawDataUrl}${fileName}`);
  if (!response.ok) {
    throw new Error(`Unable to download ${fileName}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function buildData() {
  const records = [];
  const seen = new Set();

  for (const fileName of sourceFiles) {
    const workbook = xlsx.parse(await fetchWorkbook(fileName));
    for (const sheet of workbook) {
      const semester = getSemester(sheet.name);
      if (!semester || !Array.isArray(sheet.data) || sheet.data.length < 2) {
        continue;
      }

      const headers = sheet.data[0].map((header) => String(header).trim());
      for (const row of sheet.data.slice(1)) {
        if (!Array.isArray(row) || row.length < 3) {
          continue;
        }

        const rawCourse = getCell(row, 0);
        const parsedCode = parseCourseCode(rawCourse);
        const courseTitle = getCell(row, 1);
        const rawInstructor = getCell(row, 2);
        if (!parsedCode || !courseTitle || !rawInstructor) {
          continue;
        }

        const instructor = normalizeInstructor(rawInstructor);
        const grades = normalizeGrades(headers, row);
        const record = {
          courseCode: parsedCode.courseCode,
          section: parsedCode.section,
          courseTitle,
          semester,
          instructor,
          grades,
          ...summarizeGrades(grades),
        };
        const recordKey = JSON.stringify(record);
        if (!seen.has(recordKey)) {
          seen.add(recordKey);
          records.push(record);
        }
      }
    }
  }

  records.sort((a, b) =>
    `${a.courseCode}:${a.section}:${a.semester}:${a.instructor}`.localeCompare(
      `${b.courseCode}:${b.section}:${b.semester}:${b.instructor}`,
    ),
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(records)}\n`);
  console.log(`Wrote ${records.length} course records to ${path.relative(projectRoot, outputPath)}`);
}

buildData().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
