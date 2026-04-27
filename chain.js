const categories = ["Bible", "EMT", "Writing"];
const chainTodayLabel = document.querySelector("#chainTodayLabel");
const chainMessage = document.querySelector("#chainMessage");
const chainMonthLabel = document.querySelector("#chainMonthLabel");
const monthGain = document.querySelector("#monthGain");
const monthGainMeta = document.querySelector("#monthGainMeta");
const monthGainFormula = document.querySelector("#monthGainFormula");
const currentStreakEl = document.querySelector("#currentStreak");
const longestStreakEl = document.querySelector("#longestStreak");
const completionRateEl = document.querySelector("#completionRate");
const chainTodayStatus = document.querySelector("#chainTodayStatus");
const chainGrid = document.querySelector("#chainGrid");
const overallHabitMeta = document.querySelector("#overallHabitMeta");
const bibleGrid = document.querySelector("#bibleGrid");
const emtGrid = document.querySelector("#emtGrid");
const writingGrid = document.querySelector("#writingGrid");
const bonusGrid = document.querySelector("#bonusGrid");
const bibleGain = document.querySelector("#bibleGain");
const emtGain = document.querySelector("#emtGain");
const writingGain = document.querySelector("#writingGain");
const bonusGain = document.querySelector("#bonusGain");
const skipToday = document.querySelector("#skipToday");

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
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
  const monthDays = getMonthDays(today);
  const statuses = monthDays.map((date) => ({
    date,
    key: toDateKey(date),
    level: getDayLevel(toDateKey(date)),
  }));

  renderGrid(statuses);
  renderCategoryGrid(bibleGrid, monthDays, "Bible");
  renderCategoryGrid(emtGrid, monthDays, "EMT");
  renderCategoryGrid(writingGrid, monthDays, "Writing");
  renderCategoryGrid(bonusGrid, monthDays, "bonus");

  const currentStreak = getCurrentStreak(today);
  const longestStreak = getLongestStreak(monthDays);
  const completionRate = getCompletionRate(today, 30);
  const monthStats = getMonthImprovement(today);
  const todayLevel = getDayLevel(todayKey);
  const bibleStats = getCategoryMonthImprovement(today, "Bible");
  const emtStats = getCategoryMonthImprovement(today, "EMT");
  const writingStats = getCategoryMonthImprovement(today, "Writing");
  const bonusStats = getCategoryMonthImprovement(today, "bonus");

  chainMonthLabel.textContent = monthFormatter.format(today);
  currentStreakEl.textContent = `${currentStreak}`;
  longestStreakEl.textContent = `${longestStreak}`;
  completionRateEl.textContent = `${completionRate}%`;
  monthGain.textContent = `${monthStats.percent.toFixed(2)}%`;
  monthGainMeta.textContent = `${monthStats.completedDays} completed 1% day${monthStats.completedDays === 1 ? "" : "s"}`;
  monthGainFormula.textContent = `1.01^${monthStats.completedDays} = ${monthStats.multiplier.toFixed(4)}x`;
  overallHabitMeta.textContent = `${monthStats.completedDays}/${monthDays.length} full core-task days`;
  bibleGain.textContent = `${bibleStats.percent.toFixed(2)}% better`;
  emtGain.textContent = `${emtStats.percent.toFixed(2)}% better`;
  writingGain.textContent = `${writingStats.percent.toFixed(2)}% better`;
  bonusGain.textContent = `${bonusStats.percent.toFixed(2)}% better`;
  chainMessage.textContent = currentStreak > 0 ? `${currentStreak}-day streak` : "Don't break the chain";
  chainTodayStatus.textContent = getTodayStatusText(todayLevel);
}

function renderGrid(statuses) {
  chainGrid.replaceChildren(
    ...statuses.map(({ date, key, level }) => {
      const isFuture = stripTime(date) > stripTime(today);
      const displayLevel = isFuture ? "level-future" : level;
      const isCompleted = level === "level-complete" || level === "level-bonus";
      const cell = document.createElement("div");
      cell.className = `chain-cell ${displayLevel}${key === todayKey ? " today" : ""}${isCompleted || isFuture ? " locked" : ""}`;
      cell.title = `${dayFormatter.format(date)}: ${displayLevel.replace("level-", "").replace("-", " ")}`;
      cell.setAttribute("aria-label", cell.title);
      if (!isFuture) {
        cell.tabIndex = 0;
        cell.setAttribute("role", "button");
        cell.addEventListener("click", () => toggleSkipForDay(key));
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleSkipForDay(key);
          }
        });
      }
      return cell;
    })
  );
}

function renderCategoryGrid(container, dates, category) {
  container.replaceChildren(
    ...dates.map((date) => {
      const key = toDateKey(date);
      const level = stripTime(date) > stripTime(today) ? "level-future" : getCategoryLevel(key, category);
      const cell = document.createElement("div");
      cell.className = `chain-cell ${level}${key === todayKey ? " today" : ""}${level !== "level-missed" ? " locked" : ""}`;
      cell.title = `${dayFormatter.format(date)}: ${getCategoryLabel(level, category)}`;
      cell.setAttribute("aria-label", cell.title);
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
  const completed = days.filter((day) => isOnePercentDay(toDateKey(day))).length;
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
    if (isOnePercentDay(toDateKey(date))) {
      running += 1;
      longest = Math.max(longest, running);
    } else if (level !== "level-skip") {
      running = 0;
    }
  });

  return longest;
}

function getMonthImprovement(date) {
  const days = getMonthDays(date).filter((day) => day <= stripTime(date));
  const completedDays = days.filter((day) => isOnePercentDay(toDateKey(day))).length;
  const multiplier = Math.pow(1.01, completedDays);
  return {
    completedDays,
    multiplier,
    percent: (multiplier - 1) * 100,
  };
}

function getCategoryMonthImprovement(date, category) {
  const days = getMonthDays(date).filter((day) => day <= stripTime(date));
  const completedDays = days.filter((day) => isCategorySuccess(toDateKey(day), category)).length;
  const multiplier = Math.pow(1.01, completedDays);
  return {
    completedDays,
    multiplier,
    percent: (multiplier - 1) * 100,
  };
}

function getTrailingDays(date, totalDays) {
  return Array.from({ length: totalDays }, (_, index) => {
    const next = new Date(date);
    next.setDate(date.getDate() - (totalDays - index - 1));
    next.setHours(0, 0, 0, 0);
    return next;
  });
}

function getMonthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const next = new Date(year, month, index + 1);
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

function isOnePercentDay(dateKey) {
  const level = getDayLevel(dateKey);
  return level === "level-complete" || level === "level-bonus";
}

function getCategoryLevel(dateKey, category) {
  if (state.skipDays?.[dateKey]) return "level-skip";
  if (isCategorySuccess(dateKey, category)) return category === "bonus" ? "level-bonus" : "level-complete";
  return "level-missed";
}

function isCategorySuccess(dateKey, category) {
  if (category === "bonus") {
    return Boolean(state.focusDays?.[dateKey]);
  }

  return Boolean(state.days?.[dateKey]?.[category]);
}

function getCategoryLabel(level, category) {
  if (level === "level-skip") return "skip";
  if (level === "level-missed") return "missed";
  if (category === "bonus") return "extra mile completed";
  return `${category.toLowerCase()} completed`;
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
