# Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data
**NEPSE Algorithmic Trading & Analytics Suite**

---

## 1. Executive Summary & Data Schema

The `storeDailyClose` engine captures an 11-column OHLCV matrix for all tracked NEPSE symbols over a rolling **60-trading-day window**:

```
Columns:
[0] Symbol        — Ticker code (e.g., HDL, NICA, SHIVM)
[1] Date          — Trading date (YYYY-MM-DD)
[2] Open          — Day opening price
[3] High          — Day high price
[4] Low           — Day low price
[5] Close (LTP)   — Official market closing price
[6] Volume        — Total traded quantity (kitta)
[7] Point Change  — Absolute net point change vs previous close
[8] Change %      — Percentage net change
[9] Prev Close    — Prior day closing price
[10] Candle       — Candlestick classification (e.g., Bullish, Bearish, Doji)
```

Having 60 consecutive trading days of full OHLCV data per symbol enables high-level technical analysis, institutional volume detection, dynamic risk control, sector rotation, and automated decision-making.

---

## 2. Technical & Momentum Indicators

From the rolling 60-day price series:

### 2.1 Trend & Moving Averages
* **SMA-20 & SMA-50 (Simple Moving Averages)**:
  * Short-term (20-day) and medium-term (50-day) baseline trend.
  * **Golden Cross Detection**: SMA-20 crossing above SMA-50 (Bullish trend shift).
  * **Death Cross Warning**: SMA-20 crossing below SMA-50 (Bearish breakdown).
  * **Macro Filter**: Avoid buying dips when `Close < SMA-50` (prevents catching falling knives in bear trends).
* **EMA-9 & EMA-21 (Exponential Moving Averages)**:
  * Dynamic support levels for fast-moving swing trades.

### 2.2 Relative Strength Index (RSI-14) & Momentum Divergence
* **Wilder's RSI-14**:
  * Currently computed: Oversold (< 35), Neutral (35–55), Overbought (> 70).
* **RSI Bullish Divergence Screener**:
  * When Price makes a Lower Low (over a 10–20 day window) but RSI-14 forms a Higher Low. This is one of the highest-probability reversal patterns in NEPSE.
* **RSI Bearish Divergence Alert**:
  * Price hits a Higher High but RSI forms a Lower High (momentum exhaustion warning).

### 2.3 Volatility & Band Systems (Bollinger Bands)
* **Bollinger Bands (20-period, 2 StdDev)**:
  * Upper Band = `SMA-19 + (2 * StdDev)`
  * Lower Band = `SMA-19 - (2 * StdDev)`
  * **Bollinger Squeeze Alert**: Identifies when Bandwidth contracts to multi-week lows, preceding explosive breakout moves.
  * **Mean Reversion Entries**: Price tagging Lower Band with an RSI < 36 reversal.

### 3.4 MACD (Moving Average Convergence Divergence)
* Fast EMA (13), Slow EMA (26), Signal Line (9-day EMA of MACD).
* **Bullish MACD Centerline / Signal Crossover**: Confirms momentum after an oversold bounce.

---

## 4. Volume & "Smart Money" Accumulation Analytics

Volume analysis is critical for identifying institutional and operator footprints in NEPSE:

### 3.1 Relative Volume (RVOL) & Volume Surges
* **20-Day Volume Moving Average (VMA-20)**.
* **RVOL Metric**: $\text{RVOL} = \frac{\text{Today's Volume}}{\text{VMA-20}}$.
* **Volume Surge Alert**:
  * Flag stocks where $\text{RVOL} \ge 2.0$ or $3.0$ on a green candle ($\text{Close} > \text{Open}$).
  * Distinguishes genuine institutional accumulation from low-liquidity price drift.

### 3.2 Volume Divergence & Distribution Detection
* **Bullish Accumulation**: Price consolidating sideways or pulling back slightly while daily volume is steadily rising or volume on up-days far exceeds down-days.
* **Bearish Distribution**: Price advancing on declining volume (smart money distributing into retail buying).
* **Volume-Weighted Average Price (VWAP)** or **On-Balance Volume (OBV)** trend calculation over 60 days.

---

## 4. Price Action & Candlestick Pattern Engine

Using Open, High, Low, Close, and Prev Close relationships:

### 4.1 Automated Candlestick Pattern Detection
* **Hammer / Dragonfly Doji**: Long lower shadow ($\ge 2\times$ body) at a 20-day low / oversold level (strong demand zone reaction).
* **Bullish Engulfing**: Today's green body completely engulfs yesterday's red body at support.
* **Morning Star**: 3-day reversal setup (Long red candle $\rightarrow$ Small indecision candle $\rightarrow$ Strong green candle).
* **Shooting Star / Bearish Engulfing**: Exit warnings at resistance.

### 4.2 Dynamic Support & Resistance Generation
* **Automatic Pivot High / Low Calculation**:
  * 20-day Resistance = `Max(High[t-20 ... t])`
  * 20-day Support = `Min(Low[t-20 ... t])`
  * 60-day Range Boundaries.
* Eliminates the need to manually enter support/resistance levels in spreadsheets.
* **20-Day Donchian Breakout**:
  * Alert when `Close > 20-Day High` accompanied by `Volume > 1.5x VMA-20`.

---

## 5. Dynamic Risk Management & Portfolio Protection

### 5.1 Average True Range (ATR-14) Volatility Stops
* High-beta stocks (e.g. speculative Hydropower or Finance) fluctuate $\pm 5-8\%$ daily, whereas stable banks move $\pm 1-2\%$.
* **ATR Formula**: $\text{TR} = \max(\text{High} - \text{Low}, |\text{High} - \text{PrevClose}|, |\text{Low} - \text{PrevClose}|)$
* **Dynamic Stop-Loss**: $\text{Stop-Loss} = \text{Entry Price} - (2 \times \text{ATR}_{14})$.
* Replaces fixed static stop-losses (e.g. flat -7%) with volatility-adjusted stops.

### 5.2 Trailing Stop-Loss Engine (Chandelier Exit)
* Trailing Stop = $\text{Highest High over last } N \text{ days} - (2.5 \times \text{ATR}_{14})$.
* Automatically ratchets up as the stock makes new highs, locking in paper gains.

### 5.3 Drawdown & Value at Risk (VaR)
* **Maximum Drawdown (MDD)**: Peak-to-trough decline over the 60-day period.
* **Historical VaR (95% & 99% confidence)** for active portfolio positions.

---

## 6. Sector Rotation & Relative Strength (RS) Ranking

Grouping symbols by Sector (Hydropower, Commercial Banks, Development Banks, Microfinance, Life Insurance, Non-Life Insurance, Finance, Manufacturing, Hotels):

* **Sector Momentum Leaderboard**:
  * Measure 5-day, 10-day, 20-day, and 60-day percentage returns across all sectors.
  * Identify which sector is entering a bull wave before the general market notices.
* **Relative Strength vs NEPSE Benchmark**:
  * Stock RS Score = $\frac{\text{Stock Return}}{\text{NEPSE Index Return}}$ over 20 and 60 days.
  * Focuses trading capital strictly on top-quartile leaders in top-ranked sectors.

---

## 7. Multi-Factor Composite Scoring Engine (0 – 100)

Combine technicals, volume, and fundamentals into a single automated rating score:

| Factor | Weight | Criteria |
| :--- | :--- | :--- |
| **Trend (SMA-20 / SMA-50)** | 25 pts | Close > SMA-20 (+15), Close > SMA-50 (+10) |
| **Momentum (RSI-14)** | 25 pts | Rebounding from Oversold 30–45 (+25), Neutral 45–60 (+15) |
| **Volume Quality (RVOL)** | 20 pts | Volume > 2x 20-day Average (+20), > 1.2x (+10) |
| **Price Action / Pattern** | 15 pts | Bullish reversal candle / Support bounce (+15) |
| **Fundamental Grade** | 15 pts | P/E < 25, ROE > 12%, Healthy balance sheet (+15) |
| **Total Score** | **100 pts** | **$\ge 80$: Strong Buy \| 65–79: Watch/Accumulate \| $< 40$: Avoid/Sell** |

---

## 8. Automated Multi-Channel Alerting & Reporting

Instead of manually checking spreadsheets:

1. **Daily Post-Market Telegram / Discord Digest (3:15 PM Daily)**:
   * **Top 5 Golden Dip Setups** (RSI < 35 + Support Rebound + RVOL > 1.5).
   * **Breakouts of the Day** (New 20-day high on heavy volume).
   * **Portfolio Action Alerts** (Any held stock in `yogen` triggering Stop-Loss or Take-Profit).
2. **End-of-Day HTML Email Summary**:
   * Sent automatically via `MailApp.sendEmail()` at market close with a formatted summary table.
3. **Automated Trading Journal / Equity Curve Tracker**:
   * Automatically log daily portfolio net asset value (NAV) and track performance against the NEPSE index over time.
