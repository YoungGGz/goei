"""페르소나 여A·남A 동작 한 줄 보내기. 반드시 pixellab_check(사용자 결정 대조) → pixellab_gate(승인 회수) 순서로 거친다.

    python3 tools/pixellab_persona_motion.py <줄 파일.json> [--send]

줄 파일: {"who": "여A", "kind": "전투", "row": "전투 자세 잡기", "first_row": true,
          "start": "south-east", "direction": "east", "frames": 8, "keep_first": false,
          "end": null, "prompt": "...", "out": "<결과 폴더>"}
start 가 방향 이름이면 서버에 등록된 그 방향 그림을 받아 시작 그림으로 넣는다. "pick:<줄>:<장>" 이면 start_file 의 그림을 넣는다.
--send 가 없으면 대조만 하고 보내지 않는다."""
import base64, json, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixellab_check as C, pixellab_gate as G

API = "https://api.pixellab.ai/v2"
DEC = json.loads(C.DEC.read_text(encoding="utf-8"))["subjects"]["persona"]


def curl(*a):
    return subprocess.run(["curl", "-sS", "--retry", "3", *a], capture_output=True, check=True).stdout


def build(j):
    cid = DEC["character_ids"][j["who"]]
    if str(j["start"]).startswith("pick:"):
        img = Path(j["start_file"]).read_bytes()
    else:
        ch = json.loads(curl(f"{API}/characters/{cid}"))
        img = curl("-f", ch["rotation_urls"][j["start"]])
    body = {"character_id": cid, "mode": "pixminimax", "action_description": j["prompt"],
            "animation_name": f"{j['who']} {j['row']}", "directions": [j["direction"]],
            "frame_count": j["frames"], "keep_first_frame": bool(j.get("keep_first")), "enhance_prompt": False,
            "custom_start_frame": {"type": "base64", "base64": base64.b64encode(img).decode()}}
    if j.get("end"):
        body["end_frame"] = {"type": "base64", "base64": base64.b64encode(Path(j["end"]).read_bytes()).decode()}
    return body


def main():
    j = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    body = build(j)
    C.check("persona", j["kind"], j["row"], body, j["start"], first_row=bool(j.get("first_row")))
    print(f"대조 통과: {j['who']} {j['row']} 시작={j['start']} 방향={j['direction']} {j['frames']}장")
    if "--send" not in sys.argv:
        return
    G.spend(f"페르소나 {j['who']} {j['row']}")
    out = Path(j["out"]); out.mkdir(parents=True, exist_ok=True)
    (out / "body.json").write_text(json.dumps(body))
    res = json.loads(curl("-X", "POST", f"{API}/characters/animations", "-H", "Content-Type: application/json",
                          "-d", f"@{out / 'body.json'}"))
    (out / "submit.json").write_text(json.dumps(res, ensure_ascii=False))
    job = (res.get("background_job_ids") or [res.get("background_job_id")])[0]
    while True:
        r = json.loads(curl(f"{API}/background-jobs/{job}"))
        if r.get("status") in ("completed", "failed"):
            break
        time.sleep(10)
    (out / "job.json").write_text(json.dumps(r, ensure_ascii=False))
    for i, im in enumerate((r.get("last_response") or {}).get("images") or []):
        (out / f"{i:02d}.png").write_bytes(base64.b64decode(im["base64"]))
    print(r.get("status"), r.get("usage"))


if __name__ == "__main__":
    main()
