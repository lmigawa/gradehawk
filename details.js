const query = new URLSearchParams(window.location.search);
const courseHeading = document.querySelector("#course-heading");
const courseSummary = document.querySelector("#course-summary");
const errorMessage = document.querySelector("#error-message");
const errorText = document.querySelector("#error-text");
const retryButton = document.querySelector("#retry-button");
const summarySection = document.querySelector("#summary-section");
const summaryStudents = document.querySelector("#summary-students");
const summaryAverage = document.querySelector("#summary-average");
const summaryMedian = document.querySelector("#summary-median");
const summaryCommon = document.querySelector("#summary-common");
const histogramSection = document.querySelector("#histogram-section");
const histogram = document.querySelector("#histogram");
const distributionTableBody = document.querySelector("#distribution-table-body");
const detailControls = document.querySelector("#detail-controls");
const semesterFilter = document.querySelector("#semester-filter");
const allSemestersFilter = document.querySelector("#all-semesters-filter");
const sectionFilter = document.querySelector("#section-filter");
const groupedFilter = document.querySelector("#grouped-filter");
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
  "W",
];
const baseGrades = new Set(["A", "B", "C", "D", "F"]);
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
let allCourses = [];
let currentCourseCode = "";
let currentSemester = "";

function compareSemesters(a, b) {
  const [aSeason, aYear] = a.split(" ");
  const [bSeason, bYear] = b.split(" ");
  const yearDifference = Number(bYear) - Number(aYear);
  if (yearDifference !== 0) {
    return yearDifference;
  }
  return ["Fall", "Summer", "Spring", "Winter"].indexOf(aSeason) -
    ["Fall", "Summer", "Spring", "Winter"].indexOf(bSeason);
}

function navigateToCourse(section, instructor, grouped, semester = currentSemester) {
  const parameters = new URLSearchParams({
    courseCode: currentCourseCode,
    semester,
  });
  if (grouped) {
    parameters.set("grouped", "true");
  } else {
    parameters.set("section", section);
    parameters.set("instructor", instructor);
  }
  window.location.href = `details.html?${parameters}`;
}

function populateDetailControls(
  courseCourses,
  matchingCourses,
  section,
  instructor,
  isGrouped,
  isAllSemesters,
) {
  const semesters = [...new Set(courseCourses.map((course) => course.semester))].sort(
    compareSemesters,
  );
  semesterFilter.replaceChildren();
  semesters.forEach((semester) => {
    const option = document.createElement("option");
    option.value = semester;
    option.textContent = semester;
    option.selected = !isAllSemesters && semester === currentSemester;
    semesterFilter.append(option);
  });
  semesterFilter.disabled = isAllSemesters;
  allSemestersFilter.checked = isAllSemesters;

  const sectionOptions = [
    ...new Map(
      matchingCourses.map((course) => [
        `${course.section}|${course.instructor}`,
        course,
      ]),
    ).values(),
  ];
  sectionFilter.replaceChildren();
  sectionOptions.forEach((course) => {
    const option = document.createElement("option");
    option.value = `${course.section}|${course.instructor}`;
    option.textContent = `${course.section} — ${course.instructor}`;
    option.selected =
      !isGrouped &&
      course.section === section &&
      course.instructor === instructor;
    sectionFilter.append(option);
  });
  sectionFilter.disabled = isGrouped;
  groupedFilter.checked = isGrouped;
  detailControls.hidden = false;
}

function showError(message) {
  courseSummary.hidden = true;
  summarySection.hidden = true;
  histogramSection.hidden = true;
  errorText.textContent = message;
  errorMessage.hidden = false;
}

function getStudentCount(grades) {
  return Object.values(grades).reduce(
    (total, count) => total + (Number.isFinite(count) ? count : 0),
    0,
  );
}

function getSummaryGrade(grades, summaryType) {
  const gradePoints = {
    "A+": 4, A: 4, "A-": 3.67, "B+": 3.33, B: 3, "B-": 2.67,
    "C+": 2.33, C: 2, "C-": 1.67, "D+": 1.33, D: 1, "D-": 0.67,
    "D & F": 0.5, F: 0,
  };
  const entries = gradeOrder
    .filter((grade) => grade !== "W" && (grades[grade] || 0) > 0)
    .map((grade) => ({ grade, count: grades[grade] }));
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (!total) {
    return null;
  }
  if (summaryType === "average") {
    const points = entries.reduce(
      (sum, entry) => sum + gradePoints[entry.grade] * entry.count,
      0,
    ) / total;
    const hasModifiedGrades = entries.some(({ grade }) => modifiedGrades.has(grade));
    const availableGrades = gradeOrder.filter(
      (grade) => hasModifiedGrades || baseGrades.has(grade),
    ).filter((grade) => grade !== "W");
    return availableGrades.reduce((closest, grade) =>
      Math.abs(gradePoints[grade] - points) <
      Math.abs(gradePoints[closest] - points) ? grade : closest,
    "F");
  }
  const middle = (total - 1) / 2;
  let seen = 0;
  for (const entry of entries) {
    seen += entry.count;
    if (seen > middle) {
      return entry.grade;
    }
  }
  return entries[entries.length - 1].grade;
}

function renderSummary(grades) {
  const gradedEntries = gradeOrder
    .filter((grade) => grade !== "W" && (grades[grade] || 0) > 0)
    .map((grade) => ({ grade, count: grades[grade] }));
  const mostCommon = gradedEntries.sort((a, b) => b.count - a.count)[0]?.grade;
  summaryStudents.textContent = getStudentCount(grades);
  summaryAverage.textContent = getSummaryGrade(grades, "average") || "N/A";
  summaryMedian.textContent = getSummaryGrade(grades, "median") || "N/A";
  summaryCommon.textContent = mostCommon || "N/A";
  summarySection.hidden = false;
}

function renderHistogram(course) {
  const hasModifiedGrades = [...modifiedGrades].some(
    (grade) => (course.grades[grade] || 0) > 0,
  );
  const entries = gradeOrder
    .map((grade) => [grade, course.grades[grade] || 0])
    .filter(
      ([grade, count]) =>
        count > 0 ||
        baseGrades.has(grade) ||
        (hasModifiedGrades && modifiedGrades.has(grade)),
    );
  const maximum = Math.max(...entries.map(([, count]) => count), 1);
  const chartMaximum = Math.max(4, Math.ceil(maximum / 4) * 4);
  histogram.replaceChildren();
  distributionTableBody.replaceChildren();

  const plot = document.createElement("div");
  plot.className = "histogram-plot";
  const xAxisTitle = document.createElement("strong");
  xAxisTitle.className = "histogram-axis-title histogram-x-axis-title";
  xAxisTitle.textContent = "Grade";
  plot.append(xAxisTitle);

  entries.forEach(([grade, count]) => {
    const group = document.createElement("div");
    group.className = "histogram-column";
    group.title = `${grade}: ${count}`;

    const countLabel = document.createElement("span");
    countLabel.className = "histogram-count";
    countLabel.textContent = count;

    const bar = document.createElement("div");
    bar.className = "histogram-bar";
    bar.style.height = `${(count / chartMaximum) * 100}%`;
    bar.setAttribute("aria-label", `${grade}: ${count}`);

    const gradeLabel = document.createElement("span");
    gradeLabel.className = "histogram-label";
    gradeLabel.textContent = grade;

    group.append(countLabel, bar, gradeLabel);
    plot.append(group);

    const tableRow = document.createElement("tr");
    [grade, count].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tableRow.append(cell);
    });
    distributionTableBody.append(tableRow);
  });

  histogram.append(plot);
  histogramSection.hidden = false;
}

async function loadCourseDetails() {
  errorMessage.hidden = true;
  courseSummary.hidden = false;
  courseSummary.classList.add("is-loading");
  courseSummary.classList.remove("is-error");
  courseSummary.innerHTML =
    '<span class="loading-indicator" aria-hidden="true"></span>Loading course data...';
  const courseCode = query.get("courseCode");
  const section = query.get("section");
  const semester = query.get("semester");
  const instructor = query.get("instructor");
  const isGrouped = query.get("grouped") === "true";

  const isAllSemesters = semester === "all";

  if (!courseCode || !semester || (!instructor && !isGrouped)) {
    showError("The course details link is incomplete.");
    return;
  }

  try {
    const response = await fetch("data/courses.json");
    if (!response.ok) {
      throw new Error(`Could not load course data (${response.status})`);
    }
    allCourses = await response.json();
    currentCourseCode = courseCode;
    currentSemester = semester;
    const courseCourses = allCourses.filter((item) => item.courseCode === courseCode);
    const courseSemesterCourses = isAllSemesters
      ? courseCourses
      : courseCourses.filter((item) => item.semester === semester);
    const matchingCourses = isGrouped
      ? courseSemesterCourses
      : courseSemesterCourses.filter(
          (item) => item.section === section && item.instructor === instructor,
        );
    const course = matchingCourses[0];
    const groupedCourses = isGrouped
      ? [...new Map(
          courseSemesterCourses.map((item) => [
            `${item.semester}|${item.section}|${item.instructor}`,
            item,
          ]),
        ).values()]
      : matchingCourses;

    if (!course || groupedCourses.length === 0) {
      showError("Course details could not be found.");
      return;
    }

    populateDetailControls(
      courseCourses,
      matchingCourses,
      section,
      instructor,
      isGrouped,
      isAllSemesters,
    );
    const fullCode = isGrouped
      ? course.courseCode
      : course.section
        ? `${course.courseCode}:${course.section}`
        : course.courseCode;
    const shouldAggregate = isGrouped || isAllSemesters;
    const displayCourses = isGrouped ? groupedCourses : matchingCourses;
    const displayCourse = shouldAggregate
      ? {
          ...course,
          section: "",
          instructor: [...new Set(displayCourses.map((item) => item.instructor))].join(", "),
          semester: isAllSemesters ? "All semesters" : course.semester,
          grades: displayCourses.reduce((grades, item) => {
            Object.entries(item.grades).forEach(([grade, count]) => {
              grades[grade] = (grades[grade] || 0) + count;
            });
            return grades;
          }, {}),
        }
      : course;
    document.title = `${fullCode} - GradeHawk`;
    const scopeLabels = [
      isGrouped ? "all sections" : "",
      isAllSemesters ? "all semesters" : "",
    ].filter(Boolean);
    courseHeading.textContent =
      `${fullCode}${scopeLabels.length ? ` (${scopeLabels.join(", ")})` : ""} grade distribution`;
    courseSummary.textContent =
      `${displayCourse.courseTitle} — ${displayCourse.semester} — ${displayCourse.instructor}`;
    courseSummary.classList.remove("is-loading");
    renderSummary(displayCourse.grades);
    renderHistogram(displayCourse);
  } catch (error) {
    courseSummary.classList.remove("is-loading");
    courseSummary.classList.add("is-error");
    showError("Course data could not be loaded.");
    console.error(error);
  }
}

sectionFilter.addEventListener("change", () => {
  const [section, instructor] = sectionFilter.value.split("|");
  navigateToCourse(section, instructor, false);
});

semesterFilter.addEventListener("change", () => {
  const [section, instructor] = sectionFilter.value.split("|");
  const selectedSemester = semesterFilter.value;
  const professorTaughtSemester = allCourses.some(
    (course) =>
      course.courseCode === currentCourseCode &&
      course.semester === selectedSemester &&
      course.section === section &&
      course.instructor === instructor,
  );
  navigateToCourse(
    section,
    instructor,
    groupedFilter.checked || !professorTaughtSemester,
    selectedSemester,
  );
});

allSemestersFilter.addEventListener("change", () => {
  const [section, instructor] = sectionFilter.value.split("|");
  navigateToCourse(
    section,
    instructor,
    groupedFilter.checked,
    allSemestersFilter.checked ? "all" : semesterFilter.value,
  );
});

groupedFilter.addEventListener("change", () => {
  if (groupedFilter.checked) {
    navigateToCourse("", "", true, currentSemester);
    return;
  }

  const [section, instructor] = sectionFilter.value.split("|");
  navigateToCourse(section, instructor, false, currentSemester);
});

retryButton.addEventListener("click", loadCourseDetails);
loadCourseDetails();
