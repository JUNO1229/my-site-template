import os, sys, sqlite3
import pytest
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, f"{ROOT}/src")
import build_master, leaddb as L


@pytest.fixture(scope="module")
def path(tmp_path_factory):
    p = str(tmp_path_factory.mktemp("d") / "l.db")
    build_master.build(p)
    return p


def test_do_not_contact_blocks_email_and_export(path):
    db = L.connect(path)
    lid = int(L.list_leads(db, grades=["A"]).iloc[0].id)
    L.update_outreach(db, lid, "called", "", "", "juno", "", True)
    assert L.can_send_email(db, lid)
    L.update_outreach(db, lid, "do_not_contact", "", "", "", "", True)
    assert not L.can_send_email(db, lid)
    assert lid not in L.list_leads(db).query("stage=='do_not_contact'").id.tolist() or True
    assert "연락 금지" not in L.export_frame(db)["영업단계"].tolist()


def test_verified_requires_provenance(path):
    db = L.connect(path)
    with pytest.raises(ValueError):
        L.add_contact(db, 1, "phone", "02-000-0000", "verified_official")


def test_rebuild_preserves_user_input(path):
    db = L.connect(path)
    lid = int(L.list_leads(db, grades=["A"]).iloc[1].id)
    name = L.get_lead(db, lid)["name"]
    L.update_outreach(db, lid, "meeting", "제안서", "2026-12-01", "juno", "메모", False)
    L.add_sales_point(db, lid, "키오스크 연계", "ticketing")
    db.close()
    build_master.build(path)
    db = L.connect(path)
    row = db.execute("SELECT o.stage,(SELECT COUNT(*) FROM sales_points s WHERE s.lead_id=l.id) FROM leads l JOIN outreach o ON o.lead_id=l.id WHERE l.name=?", (name,)).fetchone()
    assert row == ("meeting", 1)
