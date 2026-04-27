const categories = ["Bible", "EMT", "Writing", "Journal", "Relationship", "Health"];
const dailyFocuses = [
  {
    focus: "Bible + Community + Church",
    task: "Prepare one thought from church or Bible reading to share with someone.",
  },
  {
    focus: "Planning + Evaluation",
    task: "Review last week, choose the three most important outcomes for this week.",
  },
  {
    focus: "Social + Planning Dates",
    task: "Reach out to one person and place one future hangout, call, or date on the calendar.",
  },
  {
    focus: "Dedicated Prayer",
    task: "Set aside an uninterrupted prayer block and write down the people or decisions you prayed for.",
  },
  {
    focus: "Study New Topic",
    task: "Spend one focused session learning a new topic and capture five useful notes.",
  },
  {
    focus: "Reflection + Remembrance + Socialization",
    task: "Record one lesson from the week and make one social touchpoint before the day ends.",
  },
  {
    focus: "Writing Day",
    task: "Advance one writing project: paper, personal statement, journal, or another draft.",
  },
];
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
const shortDayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

let today = new Date();
let todayKey = toDateKey(today);
const state = loadState();

const todayLabel = document.querySelector("#todayLabel");
const dailyStatus = document.querySelector("#dailyStatus");
const dailyPercent = document.querySelector("#dailyPercent");
const weeklyStatus = document.querySelector("#weeklyStatus");
const weeklyBar = document.querySelector("#weeklyBar");
const weekRange = document.querySelector("#weekRange");
const weekGrid = document.querySelector("#weekGrid");
const resetToday = document.querySelector("#resetToday");
const focusTitle = document.querySelector("#focusTitle");
const focusName = document.querySelector("#focusName");
const focusTask = document.querySelector("#focusTask");
const focusDone = document.querySelector("#focusDone");
const focusPanel = document.querySelector(".focus-panel");
const challengeStatus = document.querySelector("#challengeStatus");
const historyList = document.querySelector("#historyList");
const checkboxes = [...document.querySelectorAll("[data-category]")];

syncInputsToToday();

checkboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    setEntry(todayKey, checkbox.dataset.category, checkbox.checked);
    saveState();
    render();
  });
});

resetToday.addEventListener("click", () => {
  categories.forEach((category) => setEntry(todayKey, category, false));
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  setFocusEntry(todayKey, false);
  focusDone.checked = false;
  saveState();
  render();
});

focusDone.addEventListener("change", () => {
  setFocusEntry(todayKey, focusDone.checked);
  saveState();
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

render();
setInterval(refreshDateIfNeeded, 60 * 1000);

function render() {
  const doneToday = categories.filter((category) => getEntry(todayKey, category)).length;
  const dailyRatio = doneToday / categories.length;
  dailyStatus.textContent = `${doneToday} of ${categories.length} done`;
  dailyPercent.textContent = `${Math.round(dailyRatio * 100)}%`;
  document.documentElement.style.setProperty("--daily-deg", `${dailyRatio * 360}deg`);

  const week = getCurrentWeek(today);
  const totalPossible = week.length * categories.length;
  const weeklyDone = week.reduce((sum, date) => {
    const key = toDateKey(date);
    return sum + categories.filter((category) => getEntry(key, category)).length;
  }, 0);

  weeklyStatus.textContent = `${weeklyDone}/${totalPossible}`;
  weeklyBar.style.setProperty("--weekly-width", `${(weeklyDone / totalPossible) * 100}%`);
  weekRange.textContent = `${monthDayFormatter.format(week[0])} - ${monthDayFormatter.format(week[6])}`;
  renderTodayFocus();
  renderWeekGrid(week);
  renderHistory();
}

function renderTodayFocus() {
  const focus = getFocusForDate(today);
  const complete = getFocusEntry(todayKey);
  focusTitle.textContent = `${shortDayFormatter.format(today)} Focus`;
  focusName.textContent = focus.focus;
  focusTask.textContent = focus.task;
  challengeStatus.textContent = complete ? "Challenge complete" : "Challenge open";
  focusPanel.classList.toggle("challenge-complete", complete);
}

function renderWeekGrid(week) {
  weekGrid.replaceChildren(
    ...week.map((date) => {
      const key = toDateKey(date);
      const complete = categories.filter((category) => getEntry(key, category)).length;
      const focus = getFocusForDate(date);
      const challengeDone = getFocusEntry(key);
      const isPast = key < todayKey;
      const challengeText = challengeDone ? "Challenge done" : isPast ? "Challenge missed" : "Challenge open";
      const cell = document.createElement("div");
      cell.className = `day-cell${key === todayKey ? " today" : ""}${challengeDone ? " challenge-done" : ""}`;
      cell.innerHTML = `
        <strong>${shortDayFormatter.format(date)}</strong>
        <span>${complete}/${categories.length}</span>
        <small>${focus.focus}</small>
        <em>${focus.task}</em>
        <b>${challengeText}</b>
      `;
      return cell;
    })
  );
}

function renderHistory() {
  const weeks = getSavedWeeks();

  historyList.replaceChildren(
    ...weeks.map((weekStartKey) => {
      const week = getCurrentWeek(fromDateKey(weekStartKey));
      const categoryDone = week.reduce((sum, date) => {
        const key = toDateKey(date);
        return sum + categories.filter((category) => getEntry(key, category)).length;
      }, 0);
      const challengeDone = week.filter((date) => getFocusEntry(toDateKey(date))).length;
      const item = document.createElement("article");
      item.className = "history-item";
      item.innerHTML = `
        <div>
          <strong>${monthDayFormatter.format(week[0])} - ${monthDayFormatter.format(week[6])}</strong>
          <span>${categoryDone}/${week.length * categories.length} daily checks</span>
        </div>
        <div>
          <strong>${challengeDone}/7</strong>
          <span>focus challenges</span>
        </div>
      `;
      return item;
    })
  );
}

function getFocusForDate(date) {
  return dailyFocuses[date.getDay()];
}

function syncInputsToToday() {
  todayLabel.textContent = dayFormatter.format(today);
  checkboxes.forEach((checkbox) => {
    checkbox.checked = getEntry(todayKey, checkbox.dataset.category);
  });
  focusDone.checked = getFocusEntry(todayKey);
}

function refreshDateIfNeeded() {
  const nextToday = new Date();
  const nextKey = toDateKey(nextToday);

  if (nextKey !== todayKey) {
    today = nextToday;
    todayKey = nextKey;
    syncInputsToToday();
    render();
  }
}

function getSavedWeeks() {
  const keys = new Set([toDateKey(getCurrentWeek(today)[0])]);

  Object.keys(state.days || {}).forEach((key) => keys.add(toDateKey(getCurrentWeek(fromDateKey(key))[0])));
  Object.keys(state.focusDays || {}).forEach((key) => keys.add(toDateKey(getCurrentWeek(fromDateKey(key))[0])));

  return [...keys].sort().reverse();
}

function getCurrentWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function getEntry(dateKey, category) {
  return Boolean(state.days?.[dateKey]?.[category]);
}

function setEntry(dateKey, category, value) {
  state.days ||= {};
  state.days[dateKey] ||= {};
  state.days[dateKey][category] = value;
}

function getFocusEntry(dateKey) {
  return Boolean(state.focusDays?.[dateKey]);
}

function setFocusEntry(dateKey, value) {
  state.focusDays ||= {};
  state.focusDays[dateKey] = value;
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem("daily-track-state")) || { days: {} };
  } catch {
    return { days: {} };
  }
}

function saveState() {
  localStorage.setItem("daily-track-state", JSON.stringify(state));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}
