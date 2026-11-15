"""Tag every dialogue line with an emotion (drives voice prosody, face, body and listener reactions).
Run from game/: python -I tools/emotions.py   (then python -I tools/gen_voice.py ar)"""
import json

E = {
    # lobby
    'reception_1': 'warm', 'omar_l1': 'tired', 'p_lobby_a': 'calm', 'p_lobby_b': 'curious', 'omar_l2': 'worried', 'omar_l3': 'tired', 'omar_l4': 'calm',
    'bark_ryan_phone': 'pushy', 'bark_mei': 'excited', 'bark_grace': 'persuasive', 'bark_omar': 'worried',
    # office
    'nadia_brief': 'warm', 'nadia_n01': 'firm', 'p_n01_a': 'confident', 'p_n01_c': 'confident', 'p_n01_b': 'calm', 'p_n01_d': 'calm', 'p_n01_all': 'unsure',
    'nadia_n01_a': 'pleased', 'nadia_n01_c': 'firm', 'nadia_n01_bd': 'skeptical', 'nadia_n01_all': 'disappointed',
    'p_n01_val_ok_b': 'confident', 'p_n01_val_ok_d': 'confident', 'p_n01_val_bad': 'unsure', 'nadia_n01_val_ok': 'pleased', 'nadia_n01_val_bad': 'firm',
    'nadia_n01_a_first_weekday': 'confident', 'nadia_n01_a_first_weekend': 'confident', 'nadia_n01_a_end': 'warm',
    'ryan_n02': 'pushy', 'p_n02_sound': 'confident', 'p_n02_accept': 'casual', 'p_n02_weak': 'unsure', 'p_n02_later': 'calm',
    'ryan_n02_sound1': 'shocked', 'p_n02_sound2': 'calm', 'ryan_n02_sound2': 'grudging', 'ryan_n02_accept': 'happy', 'ryan_n02_weak': 'annoyed', 'ryan_n02_later': 'pushy',
    'hana_n03': 'worried', 'p_n03_ask': 'curious', 'p_n03_promise': 'casual', 'hana_n03_ask': 'hopeful', 'hana_n03_promise': 'disappointed',
    'p_n05_call': 'calm', 'p_n05_keep': 'casual', 'p_n05_drop': 'calm', 'ruth_n05': 'gentle', 'ruth_e4': 'hurt',
    'grace_n06': 'persuasive', 'p_n06_sep': 'confident', 'p_n06_center': 'casual', 'p_n06_no': 'casual',
    'grace_n06_sep': 'accepting', 'grace_n06_center': 'happy', 'grace_n06_no': 'annoyed', 'grace_bark_n06': 'persuasive',
    'secretary_call': 'warm', 'p_secretary': 'calm',
    # meeting
    'nadia_meet_open': 'firm', 'ryan_meet': 'pushy', 'mei_meet': 'excited', 'grace_meet': 'persuasive',
    'mei_n04': 'excited', 'mei_n04_beat': 'shocked', 'omar_n04_beat': 'tired', 'p_n04_sound': 'confident', 'p_n04_all': 'excited', 'p_n04_drop': 'firm',
    'mei_n04_sound': 'accepting', 'omar_n04_sound': 'hopeful', 'mei_n04_all': 'happy', 'mei_n04_drop': 'disappointed',
    'nadia_q_insight': 'firm', 'p_ins_a_strong': 'confident', 'p_ins_c_strong': 'confident', 'p_ins_b_strong': 'confident', 'p_ins_weak': 'unsure', 'p_ins_none': 'unsure',
    'nadia_q_ops': 'firm', 'p_ops_sound': 'confident', 'p_ops_ignore': 'casual', 'p_ops_unknown': 'unsure', 'omar_ops_sound': 'relieved',
    'nadia_q_measure': 'firm', 'p_meas_business': 'confident', 'p_meas_vanity': 'unsure', 'p_meas_none': 'unsure', 'ryan_meas_business': 'pleased',
    'nadia_q_risk': 'firm', 'p_risk_plan': 'confident', 'p_risk_none': 'casual', 'nadia_plans': 'firm',
    'nadia_e1': 'proud', 'nadia_e2_ops': 'skeptical', 'nadia_e2_meas': 'skeptical', 'nadia_e2_who': 'skeptical',
    'nadia_fb_discount': 'disappointed', 'nadia_fb_contest': 'disappointed', 'nadia_fb_film': 'sad', 'nadia_fb_all': 'disappointed', 'nadia_tension': 'tense',
    'p_continue': 'tense', 'p_revise': 'unsure', 'nadia_leave': 'warm',
    'anchor_e1': 'news_good', 'hana_e1': 'proud', 'anchor_e2': 'news', 'anchor_e3': 'news_bad', 'anchor_e4': 'news_bad', 'anchor_mod': 'news_bad', 'anchor_e3_cost': 'news_bad',
}
p = 'data/lines.ar.json'
d = json.load(open(p, encoding='utf8'))
missing = []
for k, v in d['lines'].items():
    v['e'] = E.get(k, 'calm')
    if k not in E: missing.append(k)
json.dump(d, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('tagged', len(d['lines']), 'missing', missing)
