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

/* Vercel 에서는 파일이 사라지므로 Vercel Blob(비공개 저장소)에 db 를 통째로 보관합니다.
   BLOB_READ_WRITE_TOKEN 이 있을 때만 켜지고, 원내 PC 에서는 지금처럼 db.json 파일을 씁니다. */
const REMOTE = !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_KEY = "onestop/db.json";
let dirty = false;
let lastBackupDay = "";

let db = null;

function ensureDirs() {
  if (REMOTE) return;
  for (const d of [DATA, BACKUP]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

/** (Blob 모드) 요청마다 맨 처음에 불러 옵니다 */
async function pull() {
  const { get: blobGet } = require("@vercel/blob");
  const r = await blobGet(BLOB_KEY, { access: "private", useCache: false });
  if (r && r.stream) {
    db = { ...EMPTY, ...JSON.parse(await new Response(r.stream).text()) };
  } else {
    db = { ...EMPTY, secret: crypto.randomBytes(32).toString("hex") };
    dirty = true; await flush();
  }
  if (!db.secret) { db.secret = crypto.randomBytes(32).toString("hex"); dirty = true; }
  return db;
}

/** (Blob 모드) 바뀐 것이 있으면 저장합니다. 응답을 보내기 전에 기다립니다 */
async function flush() {
  if (!REMOTE || !dirty || !db) return;
  const { put } = require("@vercel/blob");
  const body = JSON.stringify(db);
  const opt = { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" };
  await put(BLOB_KEY, body, opt);
  dirty = false;
  const day = new Date().toISOString().slice(0, 10);
  if (day !== lastBackupDay) {            // 하루 한 번 백업 한 벌
    await put(`onestop/backup/db-${day}.json`, body, opt);
    lastBackupDay = day;
  }
}

function load() {
  if (REMOTE) { // pull() 을 거치지 않았을 때를 위한 빈 자료
    return db || (db = { ...EMPTY, secret: crypto.randomBytes(32).toString("hex") });
  }
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
  if (REMOTE) { dirty = true; return; }
  ensureDirs();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1), "utf8");
  fs.renameSync(tmp, FILE);
}

/** 하루 한 번 백업을 남기고 30일이 지난 것은 지운다 */
function backup() {
  if (REMOTE) return;
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

/** 큰 변경(명단 합치기 등) 직전의 상태를 따로 한 벌 남겨 두어 잘못되면 되살릴 수 있게 한다 */
async function snapshot(tag) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${tag}-${stamp}.json`;
  if (REMOTE) {
    const { put } = require("@vercel/blob");
    await put(`onestop/backup/${name}`, JSON.stringify(db), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  } else {
    ensureDirs();
    fs.writeFileSync(path.join(BACKUP, name), JSON.stringify(db, null, 1), "utf8");
  }
  return name;
}

const get = () => db || load();

module.exports = { get, load, save, backup, snapshot, pull, flush, REMOTE, DATA, FILE, BACKUP };
