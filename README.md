# BC.Game Auto-Stake Automation

Automatically claim earnings, swap to BC tokens, and stake them every 5 minutes.

## Features

✅ **Automated Workflow**
- Monitors pending earnings
- Claims when available
- Swaps USD → BC
- Automatically stakes
- Every 5 minutes

✅ **State Persistence**
- Saves progress after each step
- Resumes if interrupted
- Never loses claimed amounts

✅ **Lifetime Stats**
- Tracks total USD claimed
- Tracks total BC received
- Tracks total BC staked
- Cycle count

## Setup

### 1. Install Dependencies

```bash
cd /Users/saint/dev/bc-game-automation
npm install
```

### 2. Get Your Cookies

1. Open https://bc.game in Chrome
2. Log in to your account
3. Press `F12` → Network tab
4. Make any request on the page
5. Click that request → Headers → find `Cookie:` header
6. Copy the entire value

### 3. Create .env File

```bash
cat > .env << 'EOF'
BC_GAME_COOKIES=your_full_cookie_string_here
EOF
```

Replace `your_full_cookie_string_here` with the Cookie header value from step 2.

### 4. Run It

**Foreground (watch live):**
```bash
node bc-game-automate.js
```

**Background (runs continuously):**
```bash
nohup node bc-game-automate.js > bc-game.log 2>&1 &
```

**View logs:**
```bash
tail -f bc-game.log
```

**Stop background process:**
```bash
pkill -f bc-game-automate.js
```

## How It Works

Every 5 minutes:

1. **Check** pending balance
2. **Claim** earnings (if available)
3. **Swap** USD → BC tokens
4. **Preview** stake
5. **Execute** stake
6. **Track** in lifetime stats

## Files

- `bc-game-automate.js` - Main automation script
- `package.json` - Dependencies
- `.env` - Your cookies (git-ignored)
- `.bc-game-state.json` - Current cycle state (git-ignored)
- `.bc-game-stats.json` - Lifetime stats (git-ignored)
- `bc-game.log` - Full event log (git-ignored)

## State Persistence

If a step fails:
- State is saved after each successful step
- Next run will resume from where it failed
- No earnings are lost

Example: If swap fails, next run will skip claim and try swap again.

## Troubleshooting

**"INSUFFICIENT_BALANCE"**
- You already swapped but haven't staked yet
- Check `.bc-game-state.json` - you're probably at step 2
- Run script again to continue to stake

**"HTTP 401 or 403"**
- Your cookies expired
- Get fresh cookies and update `.env`

**"No pending balance"**
- No earnings to claim yet
- Script checks every 5 minutes automatically

## Updates & Development

To add features or fix issues:

```bash
git checkout -b feature/your-feature
# Make changes
git add .
git commit -m "Description of change"
git push origin feature/your-feature
```

## Notes

- Cookies are stored locally only, never committed
- Delete `.env` when not using
- Stats accumulate - check `.bc-game-stats.json` anytime
- All activity logged to `bc-game.log` with timestamps
