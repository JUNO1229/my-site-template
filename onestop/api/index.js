"use strict";
/* Vercel 함수 진입점 — 모든 /api/* 요청을 server.js 가 처리합니다. */
module.exports = (req, res) => require("../server").handler(req, res);
