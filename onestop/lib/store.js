"use strict";
/* 자료 보관 — db.json 한 파일에 모읍니다.
   직원 316명, 봉사 내역 수천 건 정도는 이 방식으로 충분합니다.
   저장할 때마다 임시 파일에 쓰고 이름을 바꾸므로, 도중에 꺼져도 파일이 깨지지 않습니다. */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Vercel 은 쓰기 가능한 곳이 /tmp 뿐입니다(임시 · 재시작하면 사라짐). 시험 배포용.
const DATA = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/onestop-data" : path.join(__dirname, "..", "data"));
const FILE = path.join(DATA, "db.json");
const BACKUP = path.join(DATA, "backup");

const EMPTY = {
  version: 1,
  secret: "",
  employees: [],
  accounts: [],
  records: [],
  postings: [],
  apps: [],
  donations: [],
  admins: [],
};

let db = null;

function ensureDirs() {
  for (const d of [DATA, BACKUP]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function load() {
  ensureDirs();
  if (!fs.existsSync(FILE)) {
    db = { ...EMPTY, secret: crypto.randomBytes(32).toString("hex") };
    save();
    return db;
  }
  try {
    db = { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch (e) {
    // 파일이 깨졌으면 가장 최근 백업으로 되살린다
    const backups = fs.existsSync(BACKUP)
      ? fs.readdirSync(BACKUP).filter((f) => f.endsWith(".json")).sort().reverse() : [];
    if (backups.length) {
      console.error(`[경고] db.json을 읽지 못해 백업(${backups[0]})에서 되살립니다.`);
      fs.copyFileSync(path.join(BACKUP, backups[0]), FILE + ".broken");
      db = { ...EMPTY, ...JSON.parse(fs.readFileSync(path.join(BACKUP, backups[0]), "utf8")) };
    } else {
      throw new Error("db.json을 읽지 못했고 백업도 없습니다: " + e.message);
    }
  }
  if (!db.secret) { db.secret = crypto.randomBytes(32).toString("hex"); save(); }
  return db;
}

function save() {
  ensureDirs();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1), "utf8");
  fs.renameSync(tmp, FILE);
}

/** 하루 한 번 백업을 남기고 30일이 지난 것은 지운다 */
function backup() {
  ensureDirs();
  const day = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP, `db-${day}.json`);
  if (!fs.existsSync(dest) && fs.existsSync(FILE)) fs.copyFileSync(FILE, dest);
  const keep = 30;
  const files = fs.readdirSync(BACKUP).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    fs.unlinkSync(path.join(BACKUP, f));
  }
}

const get = () => db || load();

module.exports = { get, load, save, backup, DATA, FILE, BACKUP };
