import os, sys
import pytest
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, f"{ROOT}/src")
import build_master, enrich as E, leaddb as L


@pytest.fixture
def db(tmp_path):
    p = str(tmp_path / "l.db"); build_master.build(p)
    return p, L.connect(p)


def test_extract_phones_skips_mobile():
    html = "<footer>대표 1588-7789 / 033-335-5757 / 담당 010-1234-5678 / 1588-7789</footer>"
    assert E.extract_phones(html) == ["1588-7789", "033-335-5757"]


def test_mobile_candidate_rejected(db):
    with pytest.raises(ValueError):
        E.add_candidate(db[1], 1, "phone", "010-1234-5678")


def test_robots_disallow_marks_blocked(db):
    fetch = lambda u: "User-agent: *\nDisallow: /" if u.endswith("robots.txt") else "<p>02-123-4567</p>"
    r = E.collect_from_site(db[1], 1, "https://x.example/", fetch)
    assert r["status"] == "blocked" and E.pending(db[1]).status.tolist() == ["blocked"]


def test_collect_then_approve_flow_and_rebuild(db):
    path, d = db
    lid = int(L.enrichment_queue(d).iloc[0].id)
    fetch = lambda u: (_ for _ in ()).throw(OSError()) if u.endswith("robots.txt") else "<footer>대표 1588-1234</footer>"
    assert E.collect_from_site(d, lid, "https://x.example/", fetch)["phones"] == ["1588-1234"]
    assert d.execute("SELECT COUNT(*) FROM contacts WHERE lead_id=? AND value='1588-1234'", (lid,)).fetchone()[0] == 0  # 자동 반영 금지
    cid = int(E.pending(d).query("channel=='phone'").iloc[0].id)
    with pytest.raises(ValueError):
        E.approve(d, cid, "", True)  # 검수자 필수
    E.approve(d, cid, "juno", True)
    assert d.execute("SELECT confidence FROM contacts WHERE lead_id=? AND value='1588-1234'", (lid,)).fetchone()[0] == "verified_official"
    d.close(); build_master.build(path); d = L.connect(path)  # 재생성 후에도 보존
    assert d.execute("SELECT confidence FROM contacts WHERE value='1588-1234'").fetchone()[0] == "verified_official"
    assert lid not in L.enrichment_queue(d).id.tolist()
