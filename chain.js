const categories = ["Bible", "EMT", "Writing"];
const chainTodayLabel = document.querySelector("#chainTodayLabel");
const chainMessage = document.querySelector("#chainMessage");
const monthGain = document.querySelector("#monthGain");
const currentStreakEl = document.querySelector("#currentStreak");
const longestStreakEl = document.querySelector("#longestStreak");
const completionRateEl = document.querySelector("#completionRate");
const chainTodayStatus = document.querySelector("#chainTodayStatus");
const chainGrid = document.querySelector("#chainGrid");
const skipToday = document.querySelector("#skipToday");

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
let today = new Date();
let todayKey = toDateKey(today);
const state = loadState();

skipToday.checked = Boolean(state.skipDays?.[todayKey]);
chainTodayLabel.textContent = dayFormatter.format(today);

skipToday.addEventListener("change", () => {
  state.skipDays ||= {};
  state.skipDays[todayKey] = skipToday.checked;
  saveState();
  render();
});

render();
setInterval(refreshDateIfNeeded, 60 * 1000);

function render() {
  const days = getTrailingDays(today, 90);
  const statuses = days.map((date) => ({
    date,
    key: toDateKey(date),
    level: getDayLevel(toDateKey(date)),
  }));

  renderGrid(statuses);

  const currentStreak = getCurrentStreak(today);
  const longestStreak = getLongestStreak(days);
  const completionRate = getCompletionRate(today, 30);
  const monthImprovement = getMonthImprovement(today);
  const todayLevel = getDayLevel(todayKey);

  currentStreakEl.textContent = `${currentStreak}`;
  longestStreakEl.textContent = `${longestStreak}`;
  completionRateEl.textContent = `${completionRate}%`;
  monthGain.textContent = `${monthImprovement}%`;
  chainMessage.textContent = currentStreak > 0 ? `🔥 ${currentStreak}-day streak` : "Don't break the chain";
  chainTodayStatus.textContent = getTodayStatusText(todayLevel);
}

function renderGrid(statuses) {
  chainGrid.replaceChildren(
    ...statuses.map(({ date, key, level }) => {
      const isCompleted = level === "level-complete" || level === "level-bonus";
      const cell = document.createElement("div");
      cell.className = `chain-cell ${level}${key === todayKey ? " today" : ""}${isCompleted ? " locked" : ""}`;
      cell.title = `${dayFormatter.format(date)}: ${level.replace("level-", "").replace("-", " ")}`;
      cell.setAttribute("aria-label", cell.title);
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.addEventListener("click", () => toggleSkipForDay(key));
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSkipForDay(key);
        }
      });
      return cell;
    })
  );
}

function getTodayStatusText(level) {
  if (level === "level-bonus") return "All three tasks and the bonus focus are done. Strong day.";
  if (level === "level-complete") return "All three tasks are done. The chain is intact.";
  if (level === "level-skip") return "Today is marked as an optional skip. The chain is protected.";
  return "Complete all three tasks to extend the chain.";
}

function getCompletionRate(date, lookbackDays) {
  const days = getTrailingDays(date, lookbackDays);
  const completed = days.filter((day) => {
    const level = getDayLevel(toDateKey(day));
    return level === "level-complete" || level === "level-bonus";
  }).length;
  return Math.round((completed / days.length) * 100);
}

function getCurrentStreak(date) {
  let streak = 0;
  const cursor = new Date(date);

  while (true) {
    const key = toDateKey(cursor);
    const level = getDayLevel(key);
    if (level === "level-complete" || level === "level-bonus" || level === "level-skip") {
      if (level !== "level-skip") streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}

function getLongestStreak(days) {
  let longest = 0;
  let running = 0;

  days.forEach((date) => {
    const level = getDayLevel(toDateKey(date));
    if (level === "level-complete" || level === "level-bonus") {
      running += 1;
      longest = Math.max(longest, running);
    } else if (level !== "level-skip") {
      running = 0;
    }
  });

  return longest;
}

function getMonthImprovement(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const elapsed = Math.max(0, differenceInDays(start, date));
  const multiplier = Math.pow(1.01, elapsed);
  return Math.round((multiplier - 1) * 100);
}

function getTrailingDays(date, totalDays) {
  return Array.from({ length: totalDays }, (_, index) => {
    const next = new Date(date);
    next.setDate(date.getDate() - (totalDays - index - 1));
    next.setHours(0, 0, 0, 0);
    return next;
  });
}

function getDayLevel(dateKey) {
  if (state.skipDays?.[dateKey]) return "level-skip";

  const taskCount = categories.filter((category) => Boolean(state.days?.[dateKey]?.[category])).length;
  const focusDone = Boolean(state.focusDays?.[dateKey]);

  if (taskCount === categories.length && focusDone) return "level-bonus";
  if (taskCount === categories.length) return "level-complete";
  return "level-missed";
}

function toggleSkipForDay(dateKey) {
  const level = getDayLevel(dateKey);
  if (level === "level-complete" || level === "level-bonus") return;

  state.skipDays ||= {};
  state.skipDays[dateKey] = !state.skipDays[dateKey];

  if (!state.skipDays[dateKey]) {
    delete state.skipDays[dateKey];
  }

  if (dateKey === todayKey) {
    skipToday.checked = Boolean(state.skipDays[dateKey]);
  }

  saveState();
  render();
}

function refreshDateIfNeeded() {
  const nextToday = new Date();
  const nextKey = toDateKey(nextToday);

  if (nextKey !== todayKey) {
    today = nextToday;
    todayKey = nextKey;
    skipToday.checked = Boolean(state.skipDays?.[todayKey]);
    chainTodayLabel.textContent = dayFormatter.format(today);
    render();
  }
}

function differenceInDays(start, end) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((stripTime(end) - stripTime(start)) / oneDay);
}

function stripTime(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
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
