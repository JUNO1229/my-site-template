import os, sys
import pytest
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, f"{ROOT}/src")
import build_master, dispatch as D, leaddb as L


@pytest.fixture
def env(tmp_path):
    p = str(tmp_path / "l.db"); build_master.build(p)
    d = L.connect(p)
    lid = int(L.list_leads(d, grades=["A"]).iloc[0].id)
    doc = D.register_document(d, "미아방지 소개서", "intro", version="v1")
    return p, d, lid, doc


def test_email_blocked_without_consent_allowed_with(env):
    _, d, lid, doc = env
    with pytest.raises(D.DispatchBlocked):
        D.log_dispatch(d, lid, doc, "email", "juno")
    L.update_outreach(d, lid, "new", "", "", "", "", True)
    D.log_dispatch(d, lid, doc, "email", "juno", "info@example.kr")
    assert len(D.history(d, lid)) == 1


def test_first_contact_channels_need_no_consent_and_set_followup(env):
    _, d, lid, doc = env
    D.log_dispatch(d, lid, doc, "post", "juno", sent_on="2026-11-20")
    o = L.get_outreach(d, lid)
    assert o["stage"] == "doc_sent" and o["next_action_on"] == "2026-11-27"


def test_do_not_contact_blocks_all_and_opt_out(env):
    _, d, lid, doc = env
    L.update_outreach(d, lid, "new", "", "", "", "", True)
    D.record_opt_out(d, lid)
    o = L.get_outreach(d, lid)
    assert o["stage"] == "do_not_contact" and not o["consent_for_email"] and o["next_action_on"] is None
    for ch in ("call", "email", "post"):
        with pytest.raises(D.DispatchBlocked):
            D.log_dispatch(d, lid, doc, ch, "juno")


def test_sender_required(env):
    _, d, lid, doc = env
    with pytest.raises(ValueError):
        D.log_dispatch(d, lid, doc, "call", "")


def test_followups_alerts(env):
    _, d, lid, doc = env
    D.log_dispatch(d, lid, doc, "call", "juno", sent_on="2026-11-01")
    f = D.followups(d, today="2026-11-20")
    assert f[f.id == lid].alert.tolist() == ["기한 경과"]
    L.update_outreach(d, lid, "lost", "", "2026-11-01", "", "", False)
    assert lid not in D.followups(d, today="2026-11-20").id.tolist()


def test_rebuild_preserves_dispatches(env):
    p, d, lid, doc = env
    name = L.get_lead(d, lid)["name"]
    D.log_dispatch(d, lid, doc, "post", "juno", sent_on="2026-11-20")
    d.close(); build_master.build(p); d = L.connect(p)
    h = D.history(d)
    assert name in h.name.tolist() and h.document.iloc[0] == "미아방지 소개서"
