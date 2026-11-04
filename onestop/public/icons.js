/* 아이콘 — 라인형 24px */
function ico(inner, size){ return `<svg width="${size||24}" height="${size||24}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`; }
const I = {};
I.home = ico("<path d=\"M3 10.5 12 3l9 7.5\" /><path d=\"M5 9.8V20h14V9.8\" />");
I.hand = ico("<path d=\"M11 13V5.5a1.5 1.5 0 0 1 3 0V12\" /><path d=\"M14 11.5V4.5a1.5 1.5 0 0 1 3 0V13\" /><path d=\"M17 12.5v-5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-2.5a5 5 0 0 1-3.8-1.7L4 14.5a1.6 1.6 0 0 1 2.3-2.2L9 15\" />");
I.chart = ico("<path d=\"M4 20V10\" /><path d=\"M10 20V4\" /><path d=\"M16 20v-7\" /><path d=\"M3 20h18\" />");
I.gift = ico("<rect x=\"3\" y=\"9\" width=\"18\" height=\"12\" rx=\"1.5\" /><path d=\"M3 13h18M12 9v12\" /><path d=\"M12 9S9.8 3 7.5 4.3 9.4 9 12 9Zm0 0s2.2-6 4.5-4.7S14.6 9 12 9Z\" />");
I.user = ico("<circle cx=\"12\" cy=\"8\" r=\"3.6\" /><path d=\"M4.8 20a7.2 7.2 0 0 1 14.4 0\" />");
I.clipboard = ico("<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\" /><path d=\"M9 4.5h6v2.8H9z\" /><path d=\"M9 11h6M9 15h4\" />");
I.calendar = ico("<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"16\" rx=\"2\" /><path d=\"M3.5 10h17M8 3v4M16 3v4\" />");
I.check = ico("<path d=\"m5 12.5 4.5 4.5L19 7\" />");
I.box = ico("<rect x=\"2.5\" y=\"4\" width=\"19\" height=\"4.5\" rx=\"1\" /><path d=\"M4.5 8.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5\" /><path d=\"M9.5 12.5h5\" />");
I.back = ico("<path d=\"M14.5 5 7.5 12l7 7\" />");
I.logout = ico("<path d=\"M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8\" /><path d=\"m17 15 3-3-3-3M20 12H10\" />");
I.refresh = ico("<path d=\"M20 11a8 8 0 1 0-.7 4.4\" /><path d=\"M20 5v6h-6\" />");
I.plus = ico("<path d=\"M12 5v14M5 12h14\" />");
I.down = ico("<path d=\"M12 4v11\" /><path d=\"m7.5 11 4.5 4.5 4.5-4.5\" /><path d=\"M5 20h14\" />");
I.bell = ico("<path d=\"M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z\" /><path d=\"M13.7 19a2 2 0 0 1-3.4 0\" />");
I.people = ico("<circle cx=\"9\" cy=\"8\" r=\"3.2\" /><path d=\"M3.2 19.5a5.8 5.8 0 0 1 11.6 0\" /><path d=\"M16 5.4a3.2 3.2 0 0 1 0 6.2M17.5 14.4a5.8 5.8 0 0 1 3.3 5.1\" />");
I.key = ico("<circle cx=\"8\" cy=\"12\" r=\"4\" /><path d=\"M12 12h9M18 12v3.5M15.5 12v2.5\" />");
