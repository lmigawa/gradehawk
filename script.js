let courses = [];

const courseSearch = document.querySelector("#course-search");
const semesterFilter = document.querySelector("#semester-filter");
const pageSize = document.querySelector("#page-size");
const groupSections = document.querySelector("#group-sections");
const groupSemesters = document.querySelector("#group-semesters");
const status = document.querySelector("#status");
const resultsBody = document.querySelector("#course-results");
const pagination = document.querySelector("#pagination");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");
let currentPage = 1;
let sortKey = null;
let sortDirection = 0;

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
const seasonOrder = ["Winter", "Spring", "Summer", "Fall"];
const gradeCategories = [
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

function getSemesters() {
  return [...new Set(courses.map((course) => course.semester))].sort(
    (a, b) => {
      const [aSeason, aYear] = a.split(" ");
      const [bSeason, bYear] = b.split(" ");
      const yearDifference = Number(bYear) - Number(aYear);
      if (yearDifference !== 0) {
        return yearDifference;
      }
      return ["Fall", "Summer", "Spring", "Winter"].indexOf(aSeason) -
        ["Fall", "Summer", "Spring", "Winter"].indexOf(bSeason);
    },
  );
}

function populateSemesters() {
  getSemesters().forEach((semester) => {
    const option = document.createElement("option");
    option.value = semester;
    option.textContent = semester;
    semesterFilter.append(option);
  });
}

function parseSearchQuery(query) {
  const includedGroups = [];
  const excludedTerms = [];
  const termPattern = /(-?)"([^"]+)"|(\S+)/g;
  let match;
  let joinWithOr = false;

  while ((match = termPattern.exec(query)) !== null) {
    const isExcluded = match[1] === "-" || match[3]?.startsWith("-");
    const rawTerm = match[2] || match[3];
    const term = (match[2] || (isExcluded ? rawTerm.slice(1) : rawTerm)).toLowerCase();
    if (!isExcluded && term.toUpperCase() === "OR" && !match[2]) {
      joinWithOr = true;
      continue;
    }
    if (!term) {
      continue;
    }
    if (isExcluded) {
      excludedTerms.push(term);
    } else if (joinWithOr && includedGroups.length > 0) {
      includedGroups[includedGroups.length - 1].push(term);
      joinWithOr = false;
    } else {
      includedGroups.push([term]);
      joinWithOr = false;
    }
  }

  return { includedGroups, excludedTerms };
}

function matchesSearchTerm(searchableText, term) {
  if (!term.includes("*")) {
    return searchableText.includes(term);
  }

  const escapedTerm = term.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const wildcardPattern = new RegExp(
    escapedTerm.replace(/\*/g, ".*"),
    "i",
  );
  return wildcardPattern.test(searchableText);
}

function filterCourses() {
  const { includedGroups, excludedTerms } = parseSearchQuery(
    courseSearch.value.trim(),
  );
  const semester = semesterFilter.value;
  return courses.filter((course) => {
    const searchableText = (
      `${course.courseCode} ${course.courseCode.replaceAll(":", "")} ` +
      `${course.courseTitle} ${course.instructor}`
    ).toLowerCase();
    const matchesIncludedTerms =
      includedGroups.length === 0 ||
      includedGroups.every((group) =>
        group.some((term) => matchesSearchTerm(searchableText, term)),
      );
    const matchesExcludedTerms = excludedTerms.every(
      (term) => !matchesSearchTerm(searchableText, term),
    );
    const matchesSearch = matchesIncludedTerms && matchesExcludedTerms;
    return matchesSearch && (!semester || course.semester === semester);
  });
}

function groupCourses(matches, shouldGroupSections, shouldGroupSemesters) {
  const groups = new Map();
  matches.forEach((course) => {
    const keyParts = [course.courseCode];
    if (!shouldGroupSemesters) {
      keyParts.push(course.semester);
    }
    if (!shouldGroupSections) {
      keyParts.push(course.section, course.instructor);
    }
    const key = keyParts.join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        ...course,
        section: shouldGroupSections ? "" : course.section,
        instructor: shouldGroupSections ? "" : course.instructor,
        grouped: shouldGroupSections,
        groupedSemesters: shouldGroupSemesters,
        semester: shouldGroupSemesters ? "All semesters" : course.semester,
        grades: Object.fromEntries(gradeCategories.map((grade) => [grade, 0])),
        sections: [],
        instructors: [],
      });
    }

    const group = groups.get(key);
    if (!group.instructors.includes(course.instructor)) {
      group.instructors.push(course.instructor);
    }
    if (shouldGroupSections && group.sections.includes(course.section)) {
      return;
    }
    if (shouldGroupSections) {
      group.sections.push(course.section);
    }
    Object.entries(course.grades).forEach(([grade, count]) => {
      group.grades[grade] = (group.grades[grade] || 0) + count;
    });
  });

  return [...groups.values()].map((group) => ({
    ...group,
    instructor: group.instructors.join(", "),
    instructorCount: group.instructors.length,
    averageGrade: getSummaryGrade(group.grades, "average"),
    medianGrade: getSummaryGrade(group.grades, "median"),
  }));
}

function getSummaryGrade(grades, summaryType) {
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
  const gradedEntries = gradeCategories
    .filter((grade) => grade !== "W" && grades[grade] > 0)
    .map((grade) => ({ grade, count: grades[grade] }));
  const total = gradedEntries.reduce((sum, entry) => sum + entry.count, 0);
  if (!total) {
    return null;
  }

  if (summaryType === "average") {
    const points = gradedEntries.reduce(
      (sum, entry) => sum + gradePoints[entry.grade] * entry.count,
      0,
    ) / total;
    const hasModifiedGrades = gradedEntries.some(({ grade }) =>
      modifiedGrades.has(grade),
    );
    const availableGrades = gradeCategories.filter(
      (grade) =>
        grade !== "W" && (hasModifiedGrades || baseGrades.has(grade)),
    );
    return availableGrades
      .reduce((closest, grade) =>
        Math.abs(gradePoints[grade] - points) <
        Math.abs(gradePoints[closest] - points)
          ? grade
          : closest,
      "F");
  }

  let seen = 0;
  const middle = (total - 1) / 2;
  for (const entry of gradedEntries) {
    seen += entry.count;
    if (seen > middle) {
      return entry.grade;
    }
  }
  return gradedEntries[gradedEntries.length - 1].grade;
}

function compareSemesters(a, b) {
  const [aSeason, aYear] = a.split(" ");
  const [bSeason, bYear] = b.split(" ");
  const yearDifference = Number(aYear) - Number(bYear);
  return yearDifference || seasonOrder.indexOf(aSeason) - seasonOrder.indexOf(bSeason);
}

function compareCourses(a, b) {
  if (sortKey === "semester") {
    return compareSemesters(a.semester, b.semester);
  }
  if (sortKey === "averageGrade" || sortKey === "medianGrade") {
    return (
      gradeOrder.indexOf(a[sortKey]) - gradeOrder.indexOf(b[sortKey])
    );
  }
  return String(a[sortKey]).localeCompare(String(b[sortKey]));
}

function sortCourses(matches) {
  if (!sortKey || sortDirection === 0) {
    return matches;
  }

  return [...matches].sort(
    (a, b) => compareCourses(a, b) * sortDirection,
  );
}

function renderCourses(matches) {
  resultsBody.replaceChildren();
  const resultsPerPage = Number(pageSize.value);
  const pageCount = Math.ceil(matches.length / resultsPerPage);
  currentPage = Math.min(currentPage, Math.max(pageCount, 1));
  const firstResult = (currentPage - 1) * resultsPerPage;
  const pageMatches = matches.slice(firstResult, firstResult + resultsPerPage);
  const lastResult = Math.min(firstResult + pageMatches.length, matches.length);
  status.textContent = `${matches.length.toLocaleString()} result${matches.length === 1 ? "" : "s"}`;

  if (matches.length === 0) {
    pagination.hidden = true;
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No matching courses found.";
    row.append(cell);
    resultsBody.append(row);
    return;
  }

  pagination.hidden = false;
  pageStatus.textContent = `Showing ${firstResult + 1}-${lastResult} of ${matches.length.toLocaleString()}`;
  previousPage.disabled = currentPage === 1;
  nextPage.disabled = currentPage === pageCount;

  pageMatches.forEach((course) => {
    const row = document.createElement("tr");
    const courseCell = document.createElement("td");
    const courseLink = document.createElement("a");
    courseLink.className = "course-link";
    courseLink.textContent = course.section
      ? `${course.courseCode}:${course.section}`
      : course.courseCode;
    const detailParameters = course.grouped
      ? {
          courseCode: course.courseCode,
          semester: course.groupedSemesters ? "all" : course.semester,
          grouped: "true",
        }
      : course.groupedSemesters
        ? {
           courseCode: course.courseCode,
           section: course.section,
           semester: "all",
           instructor: course.instructor,
         }
      : {
         courseCode: course.courseCode,
         section: course.section,
          semester: course.semester,
          instructor: course.instructor,
        };
    courseLink.href = `details.html?${new URLSearchParams(detailParameters)}`;
    courseCell.append(courseLink);
    row.append(courseCell);

    [
      ["course-title", course.courseTitle],
      ["course-semester", course.semester],
      [
        `course-instructor${course.grouped ? " grouped-instructor" : ""}`,
        course.instructor,
      ],
      ["course-average", course.averageGrade || "N/A"],
      ["course-median", course.medianGrade || "N/A"],
    ].forEach(([className, value]) => {
      const cell = document.createElement("td");
      cell.className = className;
      cell.textContent = value;
      row.append(cell);
    });
    resultsBody.append(row);
  });

  pageMatches.forEach((course, index) => {
    if (!course.grouped || course.instructorCount <= 1) {
      return;
    }
    const instructorCell = resultsBody.rows[index].querySelector(
      ".course-instructor",
    );
    if (instructorCell.scrollWidth > instructorCell.clientWidth) {
      instructorCell.textContent = `${course.instructorCount}+`;
    }
  });
}

function updateResults() {
  const filteredCourses = filterCourses();
  renderCourses(
    sortCourses(
      groupSections.checked || groupSemesters.checked
        ? groupCourses(
            filteredCourses,
            groupSections.checked,
            groupSemesters.checked,
          )
        : filteredCourses,
    ),
  );
}

async function loadCourses() {
  try {
    const response = await fetch("data/courses.json");
    if (!response.ok) {
      throw new Error(`Could not load course data (${response.status})`);
    }
    courses = await response.json();
    populateSemesters();
    updateResults();
  } catch (error) {
    status.textContent = "Course data could not be loaded.";
    console.error(error);
  }
}

function resetAndUpdateResults() {
  currentPage = 1;
  updateResults();
}

function updateGroupingControls() {
  if (groupSemesters.checked) {
    groupSections.checked = true;
    groupSections.disabled = true;
  } else {
    groupSections.disabled = false;
  }
}

courseSearch.addEventListener("input", resetAndUpdateResults);
semesterFilter.addEventListener("change", resetAndUpdateResults);
pageSize.addEventListener("change", resetAndUpdateResults);
groupSections.addEventListener("change", resetAndUpdateResults);
groupSemesters.addEventListener("change", () => {
  updateGroupingControls();
  resetAndUpdateResults();
});
previousPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    updateResults();
  }
});
nextPage.addEventListener("click", () => {
  const pageCount = Math.ceil(filterCourses().length / Number(pageSize.value));
  if (currentPage < pageCount) {
    currentPage += 1;
    updateResults();
  }
});
document.querySelector("#filters").addEventListener("submit", (event) => {
  event.preventDefault();
});

document.querySelectorAll(".sort-button").forEach((button) => {
  button.addEventListener("click", () => {
    const clickedKey = button.dataset.sortKey;
    if (sortKey !== clickedKey) {
      sortKey = clickedKey;
      sortDirection = 1;
    } else if (sortDirection === 1) {
      sortDirection = -1;
    } else {
      sortKey = null;
      sortDirection = 0;
    }

    document.querySelectorAll(".sort-button").forEach((sortButton) => {
      const isActive = sortButton.dataset.sortKey === sortKey;
      const header = sortButton.closest("th");
      const label =
        sortButton.dataset.sortLabel ||
        sortButton.textContent.replace(/[▲▼]/g, "").trim();
      sortButton.dataset.sortLabel = label;
      const indicator = isActive
        ? sortDirection === 1
          ? " (ascending)"
          : " (descending)"
        : "";
      const sortIndicator = sortButton.querySelector(".sort-indicator");
      sortIndicator.className = `sort-indicator ${
        isActive
          ? sortDirection === 1
            ? "sort-ascending"
            : "sort-descending"
          : ""
      }`;
      if (isActive) {
        header.setAttribute(
          "aria-sort",
          sortDirection === 1 ? "ascending" : "descending",
        );
      } else {
        header.removeAttribute("aria-sort");
      }
      sortButton.setAttribute("aria-label", `${label}${indicator}`);
    });

    currentPage = 1;
    updateResults();
  });
});
updateGroupingControls();
loadCourses();
