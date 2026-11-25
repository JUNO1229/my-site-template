import re, json, sys
CAT = [  # (code, 이름, 정규식(앞부분), 종류)  종류: s=세션(횟수), q=수량(포/정)
 ("hf_bsd","고주파BSD", r"고(?:주파)?\(?BSD\)?", "s"),
 ("hf_onco","고주파(온코)", r"고(?:주파)?(?:\(?(?:온코|온|25)\)?)?", "s"),
 ("psy","싸이케어", r"싸이(?:케어)?", "s"),
 ("imu","이뮤알파", r"이뮤(?:알파)?", "s"),
 ("abn","압노바", r"압(?:노바)?(?:[AMFQ])?", "s"),
 ("isk","이스카도", r"이스(?:카(?:도)?)?(?:Q)?", "s"),
 ("mes","메시마", r"메(?:시마)?(?:F)?", "q"),
 ("gun","건칠단", r"건칠단?", "q"),
 ("pj","페인잼머", r"(?:pj|PJ|페인잼머)", "s"),
 ("gct","지씨타치온", r"(?:지씨타(?:치온)?|구치온)", "s"),
 ("nut","영양제", r"(?:영양제|라보솔|콤비(?:플렉스)?)", "s"),
 ("mer","메리트씨", r"메리트(?:씨)?", "s"),
 ("nad","나드정", r"나드정", "q"),
 ("pdq","피도큐산", r"피도큐산", "q"),
 ("hbo","고압산소", r"고압산소", "s"),
 ("wav","파동", r"파동", "s"),
 ("rev","역박동", r"역박동", "s"),
 ("vc","비타민C(VC)", r"VC\d*V?", "s"),
 ("glu","글루치온", r"글루치온", "q"),
]
FOLLOW = {"도":"도수","도수":"도수","림":"림프","림프":"림프","파":"파동","파동":"파동","역":"역박동","역박동":"역박동"}
def clean(t): return t.strip().strip('*').strip()
def split_top(s):
    out=[];d=0;cur=''
    for ch in s:
        if ch=='(' : d+=1
        if ch==')' : d=max(0,d-1)
        if ch in '+*' and d==0: out.append(cur);cur=''
        else: cur+=ch
    out.append(cur); return [clean(x) for x in out if clean(x)]
def parse_follow(txt):
    res=[]; rest=txt
    for m in re.finditer(r'(도수|도|림프|림|파동|파|역박동|역)\s*(\d+)?\s*(회)?\s*(k|K)?', txt):
        n=m.group(2); res.append({"item":FOLLOW[m.group(1)],"n":int(n) if n else None,"opt":"K" if m.group(4) else None})
    return res
def parse_seg(seg):
    flags=[]; 
    # 항목 찾기
    hit=None
    for code,name,rx,kind in CAT:
        m=re.match(rx,seg)
        if m and (not hit or len(m.group(0))>len(hit[3].group(0))): hit=(code,name,kind,m)
    if not hit: return {"raw":seg,"error":"항목 인식 불가"}
    code,name,kind,m=hit; rest=seg[m.end():]; it={"code":code,"name":name,"raw":seg}
    # 변형/단계
    if code=="abn":
        v=re.match(r'압(?:노바)?([AMFQ])?',seg); it["variant"]=v.group(1)
        if not it["variant"]: flags.append("압노바 종류(A/M/F/Q) 미표기")
        st=re.search(r'(\d)\s*단계',seg) or re.search(r'\(\s*(?:[AMFQ])?(\d)\s*단계\)',seg)
        if st: it["stage"]=int(st.group(1))
    if code=="hf_onco":
        base=re.match(r'고(?:주파)?(?:\(?(온코|온|25)\)?)?',seg).group(1)
        if base=="25": flags.append("'고(25)' 의미 확인 필요")
        if not base: flags.append("고주파 종류(BSD/온코) 미표기 → 온코로 가정")
    # 빈도
    wk=re.search(r'(?:격주\s*(\d+))|(?:주\s*(\d+))|(?:\(주\s*(\d+)\))',rest)
    if wk:
        if wk.group(1): it["every_other_week"]=int(wk.group(1)); 
        else: it["per_week"]=int(wk.group(2) or wk.group(3))
    mo=re.search(r'월\s*(\d+)\s*(?:회|포|정)?',rest)
    if mo and kind=="s": it["per_month"]=int(mo.group(1))
    tot=re.search(r'총\s*(\d+)\s*회',rest)
    if tot: it["total"]=int(tot.group(1))
    q=re.search(r'(\d+)\s*(포|정|V)',seg)
    if q and (kind=="q" or code in("vc","gct")): it["qty"]=int(q.group(1)); it["unit"]=q.group(2)
    elif kind=="q":
        q2=re.match(r'[^0-9]*?(\d+)',seg[m.end():])
        if q2: it["qty"]=int(q2.group(1)); it["unit"]="포" ; flags.append("수량 단위 추정")
    # 옵션
    if re.search(r'(?<![A-Za-z가-힣])[Ss](?![A-Za-z])|서비스',rest) or re.search(r'\)\s*[Ss]\b',rest) or rest.endswith('S') or rest.endswith('s'): it["option"]="S"
    if re.search(r'월\d+K|\bk\b|\(월\d+K\)',rest): it["option"]="K"
    # 페인잼머 후속
    if code=="pj":
        f=re.sub(r'(?:pj|PJ|페인잼머)','',seg)
        f=re.sub(r'\(?주\s*\d+\)?|월\s*\d+\s*회?|\(월\s*\d+\)','',f)
        f=re.sub(r'후속','',f)
        fl=parse_follow(f)
        if fl: it["followups"]=fl
        # 합 검증
        tot_f=sum(x["n"] or 0 for x in fl)
        if "per_week" in it and fl:
            if tot_f==it["per_week"]: it["follow_unit"]="주"
            elif "per_month" in it and tot_f==it["per_month"]: it["follow_unit"]="월"
            elif tot_f: flags.append(f"후속합계({tot_f})가 주{it['per_week']}/월{it.get('per_month','?')}와 불일치")
    # 빈도 정보가 하나도 없음
    if kind=="s" and not any(k in it for k in("per_week","per_month","total","every_other_week")):
        bare=re.match(r'^\s*(\d+)',rest)
        if bare: it["per_week"]=int(bare.group(1)); flags.append(f"'{name}{bare.group(1)}' 숫자를 주{bare.group(1)}회로 해석(확인 필요)")
        elif code not in("wav","rev","hbo","pj") : flags.append("횟수 정보 없음")
    if it.get("per_week") and not it.get("per_month") and kind=="s": it["per_month"]=it["per_week"]*4
    if flags: it["flags"]=flags
    return it
def parse(plan):
    segs=split_top(plan); items=[];unk=[]
    for s in segs:
        r=parse_seg(s)
        (unk if "error" in r else items).append(r)
    return items,unk
if __name__=="__main__":
    L=[l.strip() for l in open('/tmp/claude-0/plans.txt') if l.strip()]
    ok=part=bad=0; rows=[]
    for i,l in enumerate(L,1):
        items,unk=parse(l); fl=[f for it in items for f in it.get("flags",[])]
        st="OK" if not unk and not fl else ("확인" if items else "실패")
        if st=="OK": ok+=1
        elif st=="확인": part+=1
        else: bad+=1
        rows.append((i,l,items,unk,fl,st))
    json.dump(rows,open('/tmp/claude-0/design/result.json','w'),ensure_ascii=False,indent=1)
    print(f"전체 {len(L)} | 자동 확정(OK) {ok} | 확인 필요 {part} | 실패 {bad}")
    for i,l,items,unk,fl,st in rows:
        if st!="OK": print(i,st,l,"\n    ",fl,[u['raw'] for u in unk])
