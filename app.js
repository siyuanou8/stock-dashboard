const form = document.getElementById("stock-form");
const symbolInput = document.getElementById("symbol-input");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const symbolTextEl = document.getElementById("symbol-text");
const priceTextEl = document.getElementById("price-text");
const currencyTextEl = document.getElementById("currency-text");
const timeTextEl = document.getElementById("time-text");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function formatPrice(price) {
  if (typeof price !== "number" || Number.isNaN(price)) return "-";
  return price.toFixed(2);
}

function formatTime(timestamp, locale = "zh-CN") {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString(locale);
}

function drawChart(points) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 900;
  const cssHeight = canvas.clientHeight || 320;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (!points.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText("暂无可绘制的历史数据", 20, 40);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 28, left: 44 };
  const plotWidth = cssWidth - padding.left - padding.right;
  const plotHeight = cssHeight - padding.top - padding.bottom;

  const prices = points.map((p) => p.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(cssWidth - padding.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#475569";
  ctx.font = "12px sans-serif";
  ctx.fillText(max.toFixed(2), 4, padding.top + 4);
  ctx.fillText(min.toFixed(2), 4, padding.top + plotHeight);

  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = padding.left + (index / (points.length - 1 || 1)) * plotWidth;
    const y = padding.top + ((max - point.close) / span) * plotHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const last = points[points.length - 1];
  const lastX = padding.left + plotWidth;
  const lastY = padding.top + ((max - last.close) / span) * plotHeight;
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

async function fetchStockData(symbol) {
  const encoded = encodeURIComponent(symbol.toUpperCase());
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1mo&interval=1d`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    const err = data?.chart?.error?.description || "未找到该股票代码";
    throw new Error(err);
  }

  const meta = result.meta || {};
  const quotes = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const closes = quotes.close || [];
  const points = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (typeof close === "number" && Number.isFinite(close)) {
      points.push({ ts: timestamps[i], close });
    }
  }

  return {
    symbol: meta.symbol || symbol.toUpperCase(),
    price: meta.regularMarketPrice,
    currency: meta.currency || "-",
    marketTime: meta.regularMarketTime,
    points
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) {
    setStatus("请输入有效股票代码。", true);
    resultEl.classList.add("hidden");
    return;
  }

  setStatus("查询中，请稍候...");
  resultEl.classList.add("hidden");

  try {
    const data = await fetchStockData(symbol);
    symbolTextEl.textContent = data.symbol;
    priceTextEl.textContent = formatPrice(data.price);
    currencyTextEl.textContent = data.currency;
    timeTextEl.textContent = formatTime(data.marketTime);
    drawChart(data.points);
    resultEl.classList.remove("hidden");
    setStatus(`查询成功：${data.symbol}`);
  } catch (err) {
    setStatus(`查询失败：${err.message}`, true);
    resultEl.classList.add("hidden");
  }
});

window.addEventListener("resize", () => {
  if (!resultEl.classList.contains("hidden")) {
    const line = priceTextEl.textContent;
    if (line && line !== "-") {
      const symbol = symbolTextEl.textContent;
      fetchStockData(symbol).then((d) => drawChart(d.points)).catch(() => {});
    }
  }
});
