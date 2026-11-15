;(function () {
	var STORAGE_KEY = 'dora.splash.v1'
	var COLOR_KEYS = [
		'background',
		'foreground',
		'card',
		'muted',
		'mutedForeground',
		'border',
		'primary',
		'primaryForeground',
		'sidebarAccent',
		'sidebarForeground'
	]
	var MAX_TABLES = 16
	var MAX_TABS = 6
	var MAX_COLUMNS = 12
	var MAX_ROWS = 80
	var SHEEN_ROWS = 14
	var STAGGER_ROWS = 10

	var LOGO_PATHS =
		'<path class="p1" d="m515 153h13l18 2 22 6 16 8 15 9v2l5 2 13 13 4 5 4 7 6 10 5 11 4 13 2 13v8l8 1 16 4 24 9 16 7 16 8 14 8 8 5v2l4 1v2l4 1v2l4 2 9 8 11 14 9 18 3 12v87l-3 15-7 16-3 6 5 5 6 13 2 11v79l-5 18-7 14 1 5 7 11 3 9 1 7v75l-3 16-6 15-10 15-6 7-5 5-10 9-19 13-22 12-23 10-33 11-32 8-37 6-27 3-16 1h-54l-35-3-35-5-32-7-16-5-27-9-21-9-19-10-18-12-11-9-15-15-7-10-8-16-4-15-1-6v-73l4-17 8-13 1-3-8-16-4-15-1-9v-71l4-16 5-10 3-4-1-4-7-16-3-11-1-10v-77l3-17 6-14 10-14 17-17 14-10 21-12 21-10 19-7 19-6 28-7 23-4 10-2 24-3 20-5 16-7 8-6 6-7 3-6v-11l-4-6-7-6-7-3-16-2-5-4-2-4v-8l6-7 16-8 10-3z"/>' +
		'<path class="p2" d="m505 175h29l16 3 17 6 12 7 10 8 10 10 10 15 6 14 4 18v24l8 1 26 6 35 12 23 11 16 10 10 8 6 5 9 11 6 10 4 13-1 85-3 12-6 11-7 9-9 9-13 10-22 13-23 10-25 9-36 9-28 5-36 4-14 1h-50l-36-3-28-4-29-6-26-7-23-8-18-8-21-11-14-10-13-12-7-8-7-12-3-10-1-91 5-13 7-10 9-10 14-11 15-9 16-8 25-10 27-8 32-7 40-6 23-6 17-7 14-9 10-10 6-10 3-8v-17l-5-12-7-8-8-5-7-2v-2z"/>' +
		'<path class="p3" d="m267 653 4 2 12 10 19 12 22 11 23 9 29 9 24 6 33 6 35 4 14 1h63l24-2 42-6 27-6 28-8 20-7 23-10 19-10 17-12 11-9 3 3 2 5v73l-3 14-7 14-11 13-13 11-19 12-22 11-27 10-27 8-34 7-28 4-21 2-20 1h-33l-41-3-28-4-29-6-26-7-20-7-23-10-20-11-13-9-15-13-9-12-5-10-3-10-1-77z"/>'

	var ICONS = {
		terminal:
			'<path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/>',
		table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
		key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
		network:
			'<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
		compare:
			'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
		box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
		spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
		panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
		gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
		filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
		refresh:
			'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
		chevrons: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
		x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
		plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
		hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
		text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
		calendar:
			'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
		info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
	}

	var CSS =
		'#boot-screen.boot-screen--shell{background:var(--sp-background);transition:opacity 180ms cubic-bezier(.23,1,.32,1),visibility 180ms cubic-bezier(.23,1,.32,1)}' +
		'#boot-screen.boot-screen--shell .boot-stage{display:none}' +
		'.sp-app,.sp-app *{box-sizing:border-box}' +
		'.sp-app{position:absolute;inset:0;display:grid;grid-template-columns:64px 243px 1fr;font:14px/1.25 Inter,system-ui,sans-serif;color:var(--sp-sidebar-foreground);background:var(--sp-background);overflow:hidden;--sp-ease:cubic-bezier(.23,1,.32,1);--sp-skeleton:color-mix(in srgb,var(--sp-muted) 72%,transparent);--sp-hairline:var(--sp-border)}' +
		'.sp-ic{flex:none;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
		'.sp-rail{display:flex;flex-direction:column;align-items:center;border-right:1px solid var(--sp-hairline);color:var(--sp-muted-foreground)}' +
		'.sp-rail-logo{display:grid;place-items:center;width:100%;height:53px;border-bottom:1px solid var(--sp-hairline)}' +
		'.sp-rail-logo svg{width:22px;height:22px;opacity:.55;filter:grayscale(1)}' +
		'.sp-rail-logo .p1{fill:#b35c5f}.sp-rail-logo .p2{fill:#fcc5c3}.sp-rail-logo .p3{fill:#e79898}' +
		'.sp-rail-item{display:grid;place-items:center;width:40px;height:40px;margin-top:4px;border-radius:6px}' +
		'.sp-rail-item .sp-ic{width:20px;height:20px}' +
		'.sp-rail-item[data-on]{background:var(--sp-sidebar-accent);color:var(--sp-foreground)}' +
		'.sp-rail-item:first-of-type{margin-top:8px}' +
		'.sp-rail-spacer{flex:1}' +
		'.sp-rail-sep{width:32px;height:1px;margin:8px 0;background:var(--sp-hairline)}' +
		'.sp-side{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--sp-hairline)}' +
		'.sp-head{display:flex;align-items:center;gap:12px;height:54px;padding:0 8px}' +
		'.sp-avatar{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:6px;background:color-mix(in srgb,var(--sp-primary) 10%,transparent)}' +
		'.sp-who{flex:1;min-width:0;display:grid;gap:4px}' +
		'.sp-who b{font-weight:600;color:var(--sp-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
		'.sp-chips{display:flex;gap:4px}' +
		'.sp-chip{padding:0 6px;border:1px solid color-mix(in srgb,var(--sp-border) 70%,transparent);border-radius:4px;font-size:10px;line-height:14px;white-space:nowrap}' +
		'.sp-chip[data-soft]{border-color:transparent;background:color-mix(in srgb,var(--sp-muted) 60%,transparent)}' +
		'.sp-head>.sp-ic{margin-left:auto;color:var(--sp-muted-foreground)}' +
		'.sp-search{display:flex;align-items:center;gap:8px;height:49px;padding:0 8px;color:var(--sp-muted-foreground)}' +
		'.sp-box{flex:1;display:flex;align-items:center;height:32px;padding:0 10px;border:1px solid var(--sp-border);border-radius:6px}' +
		'.sp-btn{display:grid;place-items:center;width:32px;height:32px}' +
		'.sp-tables{flex:1;min-height:0;overflow:hidden;padding-top:4px}' +
		'.sp-trow{display:flex;align-items:center;gap:10px;height:32px;padding:0 12px;white-space:nowrap}' +
		'.sp-trow[data-on]{background:var(--sp-sidebar-accent);color:var(--sp-foreground)}' +
		'.sp-trow .sp-ic{color:var(--sp-muted-foreground)}' +
		'.sp-trow span{overflow:hidden;text-overflow:ellipsis}' +
		'.sp-n{margin-left:auto;font:12px/1 "JetBrains Mono",ui-monospace,monospace;color:var(--sp-muted-foreground)}' +
		'.sp-struct{flex:none;height:264px;display:flex;flex-direction:column;border-top:1px solid var(--sp-hairline)}' +
		'.sp-struct-head,.sp-struct-foot{display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:12px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--sp-muted-foreground)}' +
		'.sp-struct-head{height:33px;background:color-mix(in srgb,var(--sp-sidebar-accent) 50%,transparent);border-bottom:1px solid var(--sp-hairline)}' +
		'.sp-struct-head i{font-style:normal;font-weight:400;letter-spacing:0;text-transform:none}' +
		'.sp-struct-foot{height:39px;border-top:1px solid var(--sp-hairline)}' +
		'.sp-struct-rows{flex:1;overflow:hidden}' +
		'.sp-srow{display:flex;align-items:center;gap:8px;height:28px;padding:0 12px;font-size:13px;white-space:nowrap}' +
		'.sp-srow .sp-ic{width:14px;height:14px;color:var(--sp-muted-foreground)}' +
		'.sp-srow span{overflow:hidden;text-overflow:ellipsis}' +
		'.sp-t{margin-left:auto;font:11px/1 "JetBrains Mono",ui-monospace,monospace;color:var(--sp-muted-foreground)}' +
		'.sp-side-foot{display:flex;align-items:center;gap:14px;height:40px;padding:0 12px;border-top:1px solid var(--sp-hairline);color:var(--sp-muted-foreground)}' +
		'.sp-side-foot>:last-child{margin-left:auto}' +
		'.sp-main{display:flex;flex-direction:column;min-width:0;min-height:0}' +
		'.sp-ctabs{display:flex;align-items:center;height:32px;border-bottom:1px solid var(--sp-hairline);font-size:12px}' +
		'.sp-ctab{display:flex;align-items:center;gap:8px;height:100%;max-width:240px;padding:0 8px 0 12px;border-right:1px solid var(--sp-hairline);color:var(--sp-foreground);font-weight:500;white-space:nowrap}' +
		'.sp-ctab span:not(.sp-dot){overflow:hidden;text-overflow:ellipsis}' +
		'.sp-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--sp-muted)}' +
		'.sp-ctab .sp-ic,.sp-ttab .sp-ic{width:12px;height:12px;color:var(--sp-muted-foreground)}' +
		'.sp-plus{display:grid;place-items:center;width:32px;height:32px;color:var(--sp-muted-foreground)}' +
		'.sp-ttabs{display:flex;height:36px;border-bottom:1px solid var(--sp-hairline);font-size:12px}' +
		'.sp-ttab{display:flex;align-items:center;gap:10px;height:100%;max-width:200px;padding:0 12px;border-right:1px solid var(--sp-hairline);color:var(--sp-muted-foreground);white-space:nowrap}' +
		'.sp-ttab[data-on]{background:color-mix(in srgb,var(--sp-sidebar-accent) 50%,transparent);color:var(--sp-foreground)}' +
		'.sp-ttab span{overflow:hidden;text-overflow:ellipsis}' +
		'.sp-toolbar{display:flex;align-items:center;gap:8px;height:41px;padding:0 12px;border-bottom:1px solid var(--sp-hairline)}' +
		'.sp-gap{flex:1}' +
		'.sp-grid{position:relative;flex:1;min-height:0;overflow:hidden}' +
		'.sp-row{display:grid;grid-template-columns:var(--sp-cols);align-items:center;height:33px;border-bottom:1px solid var(--sp-hairline)}' +
		'.sp-row>span{display:flex;align-items:center;height:100%;padding:0 12px;border-right:1px solid var(--sp-hairline);overflow:hidden;white-space:nowrap}' +
		'.sp-row>span:first-child{justify-content:center;padding:0}' +
		'.sp-row[data-head]{height:36px;background:color-mix(in srgb,var(--sp-sidebar-accent) 50%,transparent);font-size:12px;font-weight:500;color:var(--sp-foreground)}' +
		'.sp-row[data-head] small{margin-left:6px;font:10px/1 "JetBrains Mono",ui-monospace,monospace;font-weight:400;color:var(--sp-muted-foreground)}' +
		'.sp-foot{display:flex;align-items:center;gap:16px;height:40px;padding:0 16px;border-top:1px solid var(--sp-hairline)}' +
		'.sp-k{position:relative;display:block;overflow:hidden;height:16px;border-radius:6px;background:var(--sp-skeleton)}' +
		'.sp-k[data-pill]{border-radius:999px}' +
		'.sp-k[data-sheen]::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 32%,color-mix(in srgb,var(--sp-foreground) 8%,transparent) 50%,transparent 68%);transform:translateX(-100%);animation:sp-sheen 2s var(--sp-ease) infinite;animation-delay:var(--sp-delay,0ms)}' +
		'.sp-in{opacity:0;animation:sp-enter 240ms var(--sp-ease) forwards;animation-delay:var(--sp-delay,0ms)}' +
		'.sp-slot{display:block;transition:opacity 160ms var(--sp-ease),transform 160ms var(--sp-ease),filter 160ms var(--sp-ease)}' +
		'.sp-slot svg{display:block;width:100%;height:100%}' +
		'.sp-slot .p1{fill:#b35c5f}.sp-slot .p2{fill:#fcc5c3}.sp-slot .p3{fill:#e79898}' +
		'.sp-slot path{transform-box:fill-box;transform-origin:center}' +
		'.sp-slot .p3{animation:sp-rise 420ms var(--sp-ease) both,sp-sink 1800ms ease-in-out 700ms infinite alternate}' +
		'.sp-slot .p1{animation:sp-settle 420ms var(--sp-ease) 70ms both}' +
		'.sp-slot .p2{animation:sp-drop 420ms var(--sp-ease) 140ms both,sp-lift 1800ms ease-in-out 700ms infinite alternate}' +
		'.boot-screen--out .sp-slot{opacity:0;transform:scale(.92);filter:blur(2px)}' +
		'@keyframes sp-sheen{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}' +
		'@keyframes sp-enter{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
		'@keyframes sp-rise{from{opacity:0;transform:translateY(45%)}to{opacity:1;transform:none}}' +
		'@keyframes sp-settle{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}' +
		'@keyframes sp-drop{from{opacity:0;transform:translateY(-35%)}to{opacity:1;transform:none}}' +
		'@keyframes sp-lift{to{transform:translateY(-7%)}}' +
		'@keyframes sp-sink{to{transform:translateY(4%)}}' +
		'@media (prefers-reduced-motion:reduce){.sp-k[data-sheen]::after{animation:none}.sp-in,.sp-slot path{animation-duration:1ms;animation-delay:0ms;animation-iteration-count:1}#boot-screen.boot-screen--shell{transition-duration:1ms}}'

	function isColor(value) {
		return (
			typeof value === 'string' &&
			/^rgba?\(\d{1,3}, ?\d{1,3}, ?\d{1,3}(, ?(0|1|0?\.\d+))?\)$/.test(value)
		)
	}

	function readText(value, max) {
		if (typeof value !== 'string') return ''
		return value.slice(0, max)
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
	}

	function parseSnapshot(raw) {
		var data
		try {
			data = JSON.parse(raw)
		} catch {
			return null
		}
		if (!data || data.v !== 1 || data.view !== 'database-studio') return null
		if (!data.colors || !data.connection || !Array.isArray(data.tables)) return null

		var colors = {}
		for (var i = 0; i < COLOR_KEYS.length; i++) {
			var key = COLOR_KEYS[i]
			if (!isColor(data.colors[key])) return null
			colors[key] = data.colors[key]
		}

		var name = readText(data.connection.name, 80)
		var provider = readText(data.connection.provider, 40)
		if (!name || !provider) return null

		var tables = []
		for (var t = 0; t < data.tables.length && tables.length < MAX_TABLES; t++) {
			var table = data.tables[t]
			var tableName = table && readText(table.name, 80)
			if (!tableName) continue
			tables.push({
				name: tableName,
				count: typeof table.count === 'number' && table.count >= 0 ? table.count : null
			})
		}

		var tabs = []
		var rawTabs = Array.isArray(data.tabs) ? data.tabs : []
		for (var b = 0; b < rawTabs.length && tabs.length < MAX_TABS; b++) {
			var label = rawTabs[b] && readText(rawTabs[b].label, 60)
			if (label) tabs.push({ label: label, active: rawTabs[b].active === true })
		}

		var columns = []
		var rawColumns = Array.isArray(data.columns) ? data.columns : []
		for (var c = 0; c < rawColumns.length && columns.length < MAX_COLUMNS; c++) {
			var columnName = rawColumns[c] && readText(rawColumns[c].name, 60)
			if (columnName) {
				columns.push({
					name: columnName,
					type: readText(rawColumns[c].type, 30),
					primaryKey: rawColumns[c].primaryKey === true
				})
			}
		}

		return {
			colors: colors,
			connection: {
				name: name,
				provider: provider,
				kind: readText(data.connection.kind, 30) || null
			},
			tables: tables,
			activeTable: readText(data.activeTable, 80),
			tabs: tabs,
			columns: columns
		}
	}

	function icon(name, size) {
		var style = size ? ' style="width:' + size + 'px;height:' + size + 'px"' : ''
		return '<svg class="sp-ic" viewBox="0 0 24 24"' + style + '>' + ICONS[name] + '</svg>'
	}

	function slot(size) {
		return (
			'<span class="sp-slot" style="width:' +
			size +
			'px;height:' +
			size +
			'px"><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">' +
			LOGO_PATHS +
			'</svg></span>'
		)
	}

	function bar(width, delay, sheen, pill, height) {
		return (
			'<span class="sp-k"' +
			(sheen ? ' data-sheen' : '') +
			(pill ? ' data-pill' : '') +
			' style="width:' +
			width +
			'px;height:' +
			(height || 16) +
			'px;--sp-delay:' +
			delay +
			'ms"></span>'
		)
	}

	function columnIcon(column) {
		if (column.primaryKey) return 'key'
		var type = column.type.toLowerCase()
		if (/int|serial|numeric|decimal|float|double|real/.test(type)) return 'hash'
		if (/date|time/.test(type)) return 'calendar'
		return 'text'
	}

	function railMarkup() {
		var items = ['terminal', 'table', 'key', 'network', 'compare', 'box']
			.map(function (name) {
				return (
					'<div class="sp-rail-item"' +
					(name === 'table' ? ' data-on' : '') +
					'>' +
					icon(name) +
					'</div>'
				)
			})
			.join('')
		return (
			'<nav class="sp-rail"><div class="sp-rail-logo"><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">' +
			LOGO_PATHS +
			'</svg></div>' +
			items +
			'<div class="sp-rail-spacer"></div><div class="sp-rail-item">' +
			icon('spark') +
			'</div><div class="sp-rail-item">' +
			icon('panel') +
			'</div><div class="sp-rail-sep"></div><div class="sp-rail-item" style="margin-bottom:8px">' +
			icon('gear') +
			'</div></nav>'
		)
	}

	function sideMarkup(snapshot) {
		var connection = snapshot.connection
		var chips =
			'<span class="sp-chip">' +
			escapeHtml(connection.provider) +
			'</span>' +
			(connection.kind
				? '<span class="sp-chip" data-soft>' + escapeHtml(connection.kind) + '</span>'
				: '')

		var tables = snapshot.tables
			.map(function (table) {
				var active = table.name === snapshot.activeTable
				return (
					'<div class="sp-trow"' +
					(active ? ' data-on' : '') +
					'>' +
					icon('table') +
					'<span>' +
					escapeHtml(table.name) +
					'</span>' +
					(table.count === null ? '' : '<i class="sp-n">' + table.count + '</i>') +
					'</div>'
				)
			})
			.join('')

		var structure = snapshot.columns
			.map(function (column) {
				return (
					'<div class="sp-srow">' +
					icon(columnIcon(column)) +
					'<span>' +
					escapeHtml(column.name) +
					'</span><i class="sp-t">' +
					escapeHtml(column.type) +
					'</i></div>'
				)
			})
			.join('')

		return (
			'<aside class="sp-side"><div class="sp-head"><div class="sp-avatar">' +
			slot(22) +
			'</div><div class="sp-who"><b>' +
			escapeHtml(connection.name) +
			'</b><div class="sp-chips">' +
			chips +
			'</div></div>' +
			icon('chevrons') +
			'</div><div class="sp-search"><div class="sp-box">Search...</div><span class="sp-btn">' +
			icon('filter') +
			'</span><span class="sp-btn">' +
			icon('refresh') +
			'</span></div><div class="sp-tables">' +
			tables +
			'</div><div class="sp-struct"><div class="sp-struct-head"><span>Structure</span><i>' +
			snapshot.columns.length +
			' columns</i></div><div class="sp-struct-rows">' +
			structure +
			'</div><div class="sp-struct-foot"><span>Indexes</span>' +
			bar(12, 0, false, false, 12) +
			'</div></div><div class="sp-side-foot">' +
			icon('spark') +
			icon('info') +
			icon('sun') +
			icon('gear') +
			'</div></aside>'
		)
	}

	function mainMarkup(snapshot, rowCount) {
		var tabs = snapshot.tabs.length
			? snapshot.tabs
			: [{ label: snapshot.activeTable || 'table', active: true }]
		var tabMarkup = tabs
			.map(function (tab) {
				return (
					'<div class="sp-ttab"' +
					(tab.active ? ' data-on' : '') +
					'><span>' +
					escapeHtml(tab.label) +
					'</span>' +
					icon('x') +
					'</div>'
				)
			})
			.join('')

		var toolbar =
			bar(84, 0, true, true, 28) +
			bar(78, 60, true, true, 28) +
			bar(88, 120, true, true, 28) +
			'<span class="sp-gap"></span>' +
			bar(28, 0, true, true, 28) +
			bar(28, 60, true, true, 28) +
			bar(100, 120, true, true, 28) +
			bar(28, 180, true, true, 28) +
			bar(28, 240, true, true, 28)

		var columns = snapshot.columns
		var tracks =
			'30px' + (columns.length ? ' repeat(' + columns.length + ',150px)' : '') + ' 1fr'
		var head =
			'<div class="sp-row" data-head><span><i style="width:16px;height:16px;border:1px solid var(--sp-muted-foreground);border-radius:3px;opacity:.7"></i></span>' +
			columns
				.map(function (column) {
					return (
						'<span>' +
						escapeHtml(column.name) +
						'<small>' +
						escapeHtml(column.type) +
						'</small></span>'
					)
				})
				.join('') +
			'<span></span></div>'

		var barWidth = function (index) {
			return index === 0 ? 48 : index % 3 === 0 ? 96 : index % 2 === 0 ? 64 : 128
		}
		var rows = ''
		for (var r = 0; r < rowCount; r++) {
			var delay = Math.min(r, STAGGER_ROWS) * 40
			var sheen = r < SHEEN_ROWS
			var cells = '<span>' + bar(16, delay, sheen, false) + '</span>'
			for (var c = 0; c < columns.length; c++) {
				cells += '<span>' + bar(barWidth(c), delay, sheen, false) + '</span>'
			}
			rows +=
				'<div class="sp-row sp-in" style="--sp-delay:' +
				delay +
				'ms">' +
				cells +
				'<span></span></div>'
		}

		return (
			'<div class="sp-main"><div class="sp-ctabs"><div class="sp-ctab"><span class="sp-dot"></span><span>' +
			escapeHtml(snapshot.connection.name) +
			'</span>' +
			icon('x') +
			'</div><span class="sp-plus">' +
			icon('plus') +
			'</span></div><div class="sp-ttabs">' +
			tabMarkup +
			'</div><div class="sp-toolbar">' +
			toolbar +
			'</div><div class="sp-grid" style="--sp-cols:' +
			tracks +
			'">' +
			head +
			rows +
			'</div><div class="sp-foot">' +
			bar(44, 0, false, false, 12) +
			bar(64, 0, false, false, 12) +
			bar(120, 0, false, false, 12) +
			'<span class="sp-gap"></span>' +
			bar(72, 0, false, false, 12) +
			bar(72, 0, false, false, 12) +
			bar(72, 0, false, false, 12) +
			'</div></div>'
		)
	}

	function colorVariables(colors) {
		return (
			'--sp-background:' +
			colors.background +
			';--sp-foreground:' +
			colors.foreground +
			';--sp-card:' +
			colors.card +
			';--sp-muted:' +
			colors.muted +
			';--sp-muted-foreground:' +
			colors.mutedForeground +
			';--sp-border:' +
			colors.border +
			';--sp-primary:' +
			colors.primary +
			';--sp-primary-foreground:' +
			colors.primaryForeground +
			';--sp-sidebar-accent:' +
			colors.sidebarAccent +
			';--sp-sidebar-foreground:' +
			colors.sidebarForeground
		)
	}

	function buildMarkup(snapshot, viewportHeight) {
		var rowCount = Math.min(MAX_ROWS, Math.max(8, Math.ceil((viewportHeight - 185) / 33) + 1))
		return (
			'<div class="sp-app" aria-hidden="true" style="' +
			colorVariables(snapshot.colors) +
			'">' +
			railMarkup() +
			sideMarkup(snapshot) +
			mainMarkup(snapshot, rowCount) +
			'</div>'
		)
	}

	function mount() {
		var target = document.getElementById('boot-screen')
		if (!target) return
		var raw
		try {
			raw = window.localStorage.getItem(STORAGE_KEY)
		} catch {
			return
		}
		if (!raw) return
		var snapshot = parseSnapshot(raw)
		if (!snapshot) return

		var markup = buildMarkup(snapshot, window.innerHeight)
		var style = document.createElement('style')
		style.textContent = CSS
		document.head.appendChild(style)
		target.style.setProperty('--sp-background', snapshot.colors.background)
		target.classList.add('boot-screen--shell')
		target.insertAdjacentHTML('beforeend', markup)
	}

	window.__doraBootSplash = {
		storageKey: STORAGE_KEY,
		parseSnapshot: parseSnapshot,
		buildMarkup: buildMarkup
	}

	try {
		mount()
	} catch (error) {
		console.warn('Boot splash failed, keeping the logo splash:', error)
	}
})()
