"""현재 휴리스틱이 기준 산출물(data/processed/ref_*.csv)과 일치하는지, DB 적재 규칙이 지켜지는지 검증."""
import os
import sqlite3
import sys

import pandas as pd
import pytest

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, f"{ROOT}/src")
import build_master, ingest_parks, ingest_themeparks  # noqa: E402


def dist(s):
    return s.value_counts().to_dict()


def test_parks_matches_reference(tmp_path):
    ingest_parks.main(f"{ROOT}/data/raw/parks_national_std.csv", str(tmp_path))
    new = pd.read_csv(tmp_path / "orgs_from_parks.csv")
    ref = pd.read_csv(f"{ROOT}/data/processed/ref_orgs_from_parks.csv")
    assert dist(new.g) == dist(ref["필요도"])
    assert list(new.org) == list(ref["관리기관"])


@pytest.mark.parametrize("raw,ref,permit", [("themepark_general", "ref_themepark_general", False),
                                            ("themepark_permit", "ref_themepark_permit", True)])
def test_themeparks_match_reference(tmp_path, raw, ref, permit):
    out = tmp_path / "o.csv"
    ingest_themeparks.main(f"{ROOT}/data/raw/{raw}.csv", str(out), permit)
    new, r = pd.read_csv(out), pd.read_csv(f"{ROOT}/data/processed/{ref}.csv")
    assert dist(new.grade) == dist(r["필요도"])


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    p = str(tmp_path_factory.mktemp("db") / "leads.db")
    build_master.build(p)
    return sqlite3.connect(p)


def test_no_duplicate_leads_and_outreach(db):
    assert db.execute("SELECT COUNT(*) FROM leads").fetchone()[0] == db.execute("SELECT COUNT(*) FROM outreach").fetchone()[0]
    assert db.execute("SELECT COUNT(*) FROM leads WHERE grade IS NULL").fetchone()[0] == 0


def test_departments_merged(db):
    assert db.execute("SELECT COUNT(*) FROM leads WHERE name='경기도 수원시'").fetchone()[0] == 1


def test_verified_contacts_linked(db):
    v = db.execute("SELECT value FROM contacts c JOIN leads l ON l.id=c.lead_id WHERE l.name='에버랜드' AND confidence='verified_official'").fetchall()
    assert ("031-320-5000",) in v


def test_contacts_have_provenance(db):
    assert db.execute("SELECT COUNT(*) FROM contacts WHERE confidence IS NULL").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM contacts WHERE confidence='verified_official' AND (source_url IS NULL OR verified_on IS NULL)").fetchone()[0] == 0


def test_sido_is_valid_and_agencies_classified(db):
    from ingest_parks import VALID_SIDO
    bad = db.execute("SELECT DISTINCT sido FROM leads").fetchall()
    assert all(s in VALID_SIDO for (s,) in bad), bad
    kinds = dict(db.execute("SELECT name, facility_kind FROM leads WHERE lead_type='public_org'").fetchall())
    for n in ("기장군도시관리공단", "부산관광공사", "인천시설공단", "울산시설공단"):
        assert kinds[n] == "시설관리 기관"
    sido = dict(db.execute("SELECT name, sido FROM leads WHERE name IN ('기장군도시관리공단','부산관광공사','인천시설공단','울산시설공단')").fetchall())
    assert sido == {"기장군도시관리공단": "부산광역시", "부산관광공사": "부산광역시", "인천시설공단": "인천광역시", "울산시설공단": "울산광역시"}
    assert kinds["경기도 수원시"] == "공원 관리기관"
