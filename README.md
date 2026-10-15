# GradeHawk

GradeHawk is a small static website for searching historical University of
Iowa course grade data by course and semester.

The underlying public data comes from the
[acm-uiowa/uigrades](https://github.com/acm-uiowa/uigrades) repository, in its
`src/db/seeds/data/raw-course-data` directory. The original UIGrades dataset
and its contributors are credited here; this project does not copy the
UIGrades frontend.

Semester labels are normalized to readable values such as `Spring 2025`.

## Regenerating the data

The preprocessing script downloads the six upstream XLSX files, normalizes
their section-level rows, and writes `data/courses.json`.

```sh
npm install
npm run build-data
```

The script preserves course title, semester, instructor, section, and the
source grade-distribution fields in the generated JSON. Exact duplicate rows
are removed, while separate sections and instructors remain separate results.

## Running locally

Because browsers restrict `fetch()` from local files, serve this directory with
any simple static server. For example:

```sh
python3 -m http.server
```

Then open <http://localhost:8000>.

Results are paginated in the browser so the page does not create thousands of
table rows at once. The page size can be changed to 25, 50, or 100 results.

Course searches support simple query terms: space-separated positive terms are
combined with AND by default. Type uppercase `OR` between terms to make them
alternatives, while terms beginning with `-` are excluded. Put a phrase in
quotes to search it as one term. For example,
`CS OR MATH data -lab` finds courses matching either CS or MATH and also
containing `data`, while excluding `lab`.
The `*` character matches any number of characters, so `CS:4*` finds all
4000-level CS courses.
Course-code searches may include or omit the colon, so both `MATH:1210` and
`math1210` find the same course.
Search terms also match instructor names.

The results table also shows each row's average and median grade category in
separate columns, calculated from the source grade distributions. For newer
source sheets that combine D and F into one category, the summary preserves
that source limitation rather than inventing a more precise split.
When a distribution contains no plus/minus categories, its average is rounded
against the base A/B/C/D/F scale rather than being reported as a plus/minus
grade.

Click any table header to sort ascending, click again to sort descending, and
click a third time to restore the default order.

Click a course code to open a separate page with a histogram showing the
grade distribution for that exact course section and semester. Zero-count
plus/minus categories are omitted when the source has no plus/minus grades.
The base `A`, `B`, `C`, `D`, and `F` categories remain visible even when their
count is zero. Source-specific categories such as `D & F` remain unchanged.

Enable `Group sections` on the search page to combine all sections of a course
within a semester into one result. The grouped detail page combines their
grade counts and lists all instructors.
Enable `Group semesters` to combine a course's results across semesters.
This can be combined with `Group sections` to produce one result for the
course's full history across all sections.

On a course detail page, use the section selector to switch among sections
from the same course and semester. Use `All sections` to switch between an
individual section distribution and the combined course distribution.
Use the semester selector to switch among semesters, or enable `All semesters`
to combine the selected section across the course's full history. This can be
combined with `All sections` to show the distribution across every section and
semester.

This site is not affiliated with or endorsed by the University of Iowa.
Historical grade distributions are provided for reference and should not be
interpreted as definitive measures of course or instructor difficulty.
