#!/usr/bin/env python3
"""Codex가 괴이봇의 퍼메를 쓰기 전에 사용하는 원문 학습 도구. 사용법은 --help."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import statistics
import subprocess
import sys
import zipfile

from build_lite_card import DECODE, ROOT

CACHE = ROOT / '.scratch' / 'first-message-study.sqlite'
ORIGINAL = '카드/원본_봇카드.jpeg'
ROOTS = ('카드', '지침', 'src', '그림', 'scripts', 'tools/build_lite_card.py', 'tools/cbs.py')
MEDIA = {'.avif', '.webp', '.png', '.jpeg', '.jpg', '.woff2'}
PAGE_SIZE = 4800
TAG = re.compile(r'<img=([^>]+)>')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inputs():
    # 추적 파일이 사라지면 read_bytes에서 실패한다. 새로 추가한 자료도 포함한다.
    result = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', *ROOTS],
        cwd=ROOT,
    )
    return sorted(set(result.decode().rstrip('\0').split('\0')))


def json_lines(value, path=''):
    """JSON 포인터와 실제 줄바꿈을 보존한 값. 빈 컨테이너, null, false도 자료에 남긴다."""
    if isinstance(value, (dict, list)) and value:
        rows = value.items() if isinstance(value, dict) else enumerate(value)
        for key, child in rows:
            key = str(key).replace('~', '~0').replace('/', '~1')
            yield from json_lines(child, f'{path}/{key}')
    else:
        body = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        yield f'{path}\n{body}\n\n'


def pages(text):
    while len(text) > PAGE_SIZE:
        stop = text.rfind('\n', PAGE_SIZE // 2, PAGE_SIZE)
        stop = stop + 1 if stop >= 0 else PAGE_SIZE
        yield text[:stop]
        text = text[stop:]
    if text:
        yield text


def decode_text(source, data):
    ext = Path(source).suffix.lower()
    if ext == '.risum':
        if data[:2] != bytes([111, 0]):
            raise ValueError(f'{source}: 지원되지 않는 모듈 헤더')
        end = 6 + int.from_bytes(data[2:6], 'little')
        if data[end:] != b'\0':
            raise ValueError(f'{source}: 추가 모듈 자료를 확인해야 합니다')
        value = json.loads(data[6:end].translate(DECODE))
    elif ext == '.json':
        value = json.loads(data)
    else:
        value = None
    if ext in ('.risum', '.json'):
        return ''.join(json_lines(value))
    return data.decode('utf-8')  # 알 수 없는 이진 형식은 누락시키지 않고 실패시킨다.


def put(db, source, data):
    kind = '에셋' if Path(source).suffix.lower() in MEDIA else '원문'
    db.execute('INSERT INTO files VALUES (?, ?, ?, ?)', (source, kind, len(data), digest(data)))
    if kind == '에셋':
        return
    for n, page in enumerate(pages(decode_text(source, data)), 1):
        key = digest(f'{source}\0{n}\0{page}'.encode())
        db.execute('INSERT INTO pages VALUES (?, ?, ?, ?)', (source, n, key, page))


def fit_contexts(db):
    """전 페이지 문단에서 명부 항목과 주변 어휘의 공기 빈도를 학습한다."""
    roster = data('install/directory.json')
    vocabulary = defaultdict(set)
    for group in ('요원', '조직', '괴이', '미스틱 사이트', '거점', '부록'):
        for name, row in roster[group].items():
            for term in (name, row.get('english', '')):
                if term:
                    vocabulary[term.casefold()].add(name)
    pattern = re.compile('|'.join(re.escape(x) for x in sorted(vocabulary, key=len, reverse=True)))
    words = re.compile(r'[가-힣]{2,}|[a-z]{3,}')
    contexts = defaultdict(Counter)
    df = Counter()
    documents = 0
    for (body,) in db.execute('SELECT body FROM pages'):
        for paragraph in body.casefold().split('\n\n'):
            terms = set(words.findall(paragraph))
            if not terms:
                continue
            documents += 1
            df.update(terms)
            names = {name for match in pattern.finditer(paragraph) for name in vocabulary[match[0]]}
            for name in names:
                contexts[name].update(terms)
    db.execute('CREATE TABLE IF NOT EXISTS context_terms (name, word, weight REAL, PRIMARY KEY(name,word))')
    db.execute('DELETE FROM context_terms')
    for name, counts in contexts.items():
        db.executemany('INSERT INTO context_terms VALUES (?,?,?)', (
            (name, word, math.log1p(count) * math.log1p(documents / df[word]))
            for word, count in counts.items()
        ))
    db.execute('CREATE INDEX IF NOT EXISTS by_word ON context_terms(word)')
    print(f'문맥 학습 {documents:,}개 문단 · 명부 표제어 {len(contexts)}개')


def build(db):
    with db:
        db.execute('CREATE TABLE IF NOT EXISTS notes (key TEXT PRIMARY KEY, note TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS files (source TEXT PRIMARY KEY, kind, bytes, sha256)')
        db.execute('CREATE TABLE IF NOT EXISTS pages (source, n INTEGER, key TEXT UNIQUE, body TEXT, PRIMARY KEY(source,n))')
        db.execute('DELETE FROM files')
        db.execute('DELETE FROM pages')
        names = inputs()
        if ORIGINAL not in names:
            raise ValueError(f'필수 원본 누락: {ORIGINAL}')
        for name in names:
            put(db, name, (ROOT / name).read_bytes())
            if name == ORIGINAL:
                with zipfile.ZipFile(ROOT / name) as archive:
                    for required in ('card.json', 'module.risum'):
                        archive.getinfo(required)
                    for entry in archive.infolist():
                        put(db, f'{name}!{entry.filename}', archive.read(entry))
        db.execute("CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(body, content='pages', tokenize='trigram')")
        db.execute("INSERT INTO passages(passages) VALUES('rebuild')")
        fit_contexts(db)
        # 모든 파일·멤버를 읽고 CRC/디코딩을 통과한 경우에만 새 목록을 커밋한다.
    status(db)


def verify(db):
    """현재 체크아웃과 아카이브에서 목록을 재발견하고 저장한 지문과 대조한다."""
    expected = {}
    def check(source, raw):
        expected[source] = digest(raw)
        if Path(source).suffix.lower() in MEDIA:
            return
        saved = ''.join(body for body, in db.execute('SELECT body FROM pages WHERE source=? ORDER BY n', (source,)))
        if saved != decode_text(source, raw):
            raise ValueError(f'원문 복원 불일치: {source}')

    for name in inputs():
        check(name, (ROOT / name).read_bytes())
    with zipfile.ZipFile(ROOT / ORIGINAL) as archive:
        for entry in archive.infolist():
            check(f'{ORIGINAL}!{entry.filename}', archive.read(entry))
    actual = dict(db.execute('SELECT source,sha256 FROM files'))
    if expected != actual:
        changed = sorted(k for k in expected.keys() | actual.keys() if expected.get(k) != actual.get(k))
        raise ValueError('색인과 달라진 자료 (build 필요): ' + ', '.join(changed))
    for source, n, key, body in db.execute('SELECT * FROM pages'):
        if key != digest(f'{source}\0{n}\0{body}'.encode()):
            raise ValueError(f'페이지 지문 오류: {source} {n}')
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise ValueError('SQLite 무결성 검사 실패')
    db.execute("INSERT INTO passages(passages,rank) VALUES('integrity-check',1)")
    print(f'경로·SHA-256 {len(actual):,}개 일치. 전체 텍스트 복원·페이지 지문·전문 색인 확인.')


def entry(name):
    found = False
    for kind in ('agents', 'orgs', 'anomalies', 'sites', 'appendices'):
        path = f'world/{kind}.json'
        records = data(path)['records']
        if name in records:
            print(f'src/data/{path} · {name}')
            print(''.join(json_lines(records[name])))
            found = True
    wiki = json.loads((ROOT / '카드/wiki-base.json').read_bytes())
    if name in wiki:
        print(f'카드/wiki-base.json · {name}\n{wiki[name]}')
        found = True
    if not found:
        raise ValueError('세계 자료와 위키에 같은 제목이 없습니다. search로 다른 표기를 찾으세요.')


def status(db):
    for kind, n in db.execute('SELECT kind,count(*) FROM files GROUP BY kind'):
        print(f'{kind} {n:,}개')
    total, seen = db.execute('SELECT count(*), count(notes.key) FROM pages LEFT JOIN notes USING(key)').fetchone()
    print(f'원문 {total:,}쪽 · 독해 메모 {seen:,}쪽 · 남은 원문 {total-seen:,}쪽')


def read(db, args):
    if args.page is not None:
        row = db.execute('SELECT * FROM pages WHERE source=? AND n=?', (args.source,args.page)).fetchone()
    elif args.key:
        row = db.execute('SELECT * FROM pages WHERE key=?', (args.key,)).fetchone()
    else:
        row = db.execute('''SELECT p.* FROM pages p LEFT JOIN notes USING(key)
            WHERE notes.key IS NULL AND instr(source, ?) > 0 ORDER BY source,n LIMIT 1''', (args.source,)).fetchone()
    if not row:
        raise ValueError('해당 페이지가 없습니다.')
    source, n, key, page = row
    print(f'{source} · {n}쪽 · {key}\n\n{page}')


def search(db, args):
    # 페이지 경계의 구절도 찾을 수 있게 같은 파일의 다음 페이지 첫 부분을 살핀다.
    term = args.term
    if not term or len(term) > PAGE_SIZE // 2:
        raise ValueError('검색어는 1~2400자로 입력하세요.')
    sql = '''SELECT p.source,p.n,p.key,p.body || coalesce(substr(q.body,1,?), '') AS passage
        FROM pages p LEFT JOIN pages q ON q.source=p.source AND q.n=p.n+1
        WHERE instr(p.source,?)>0 AND instr(lower(passage),lower(?)) BETWEEN 1 AND length(p.body)
        ORDER BY p.source,p.n LIMIT ? OFFSET ?'''
    for source,n,key,body in db.execute(sql, (len(term)-1,args.source,term,args.limit,args.offset)):
        pos = body.lower().find(term.lower())
        excerpt = body[max(0,pos-45):pos+len(term)+95].replace('\n', ' ')
        print(f'{source} · {n}쪽 · {key}\n  {excerpt}')


def data(name):
    return json.loads((ROOT / 'src/data' / name).read_text())


def examples(lang):
    directory = data('install/directory.json')
    names = {row['id']: name for name, row in directory['요원'].items()}
    for ident,row in data('world/scenes.json')['인물'].items():
        if row.get(lang):
            yield ident, '인물', names[ident], row['label'], row[lang], row.get('lore', [])
    g = data('world/greetings.json')
    for faction in data('scenarios.json')['factions']:
        for scene in faction['scenarios']:
            if scene['kind'] == 'opening':
                key = f"{faction['code']}-{lang}-{scene['fm']}"
                seeds = directory['시작 로어북'].get(f"{faction['code']}-{scene['fm']}", [])
                yield key, '공용', faction['name'], scene['label'], g['texts'][g['index'][key]], seeds


def metrics(text):
    paras = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    dialogue = sum(p.startswith(('"','“','「','**[')) for p in paras)
    return len(text), len(paras), dialogue, len(TAG.findall(text))


def style(args):
    group = [row for row in examples(args.lang) if row[1] == args.group]
    for key,_,name,label,text,_ in group:
        print(key, name, label, *metrics(text), sep='\t')
    print('열: 작품 ID, 주체, 제목, 공백·태그 포함 글자, 문단, 인용으로 시작하는 문단, 이미지 태그')
    for label,values in zip(('글자','문단','인용 시작 문단','이미지'), zip(*(metrics(row[4]) for row in group))):
        print(f'{label}  최소 {min(values)} · 중앙 {statistics.median(values):g} · 최대 {max(values)}')
    if args.draft:
        draft = args.draft.read_text()
        print('초안', *metrics(draft), sep='\t')
        pictures = {Path(row[0]).stem for row in data('install/pictures.json')}
        for tag in sorted(set(TAG.findall(draft)) - pictures):
            print('설치 이미지 목록에서 확인되지 않은 태그:', tag)


def show_example(args):
    for key, kind, name, label, text, lore in examples(args.lang):
        if args.id == key:
            if args.structure:
                print(f'{kind} · {name} · {label} · 시작 로어 {", ".join(lore)}')
                for n, para in enumerate(re.split(r'\n\s*\n', text), 1):
                    para = para.strip()
                    if TAG.fullmatch(para):
                        form = '이미지'
                    elif para.startswith(('"', '“', '「', '**[')):
                        form = '인용'
                    else:
                        form = '본문'
                    print(f'{n:02} {form} ({len(para)}자) {para}')
            else:
                print(f'{name} · {label}\n시작 로어: {", ".join(lore)}\n\n{text}')
            return
    raise ValueError(f'원문을 찾을 수 없습니다: {args.id}')


def recall(db, terms, scope, limit):
    # SQLite의 BM25가 전체 원문에서 드문 표현과 한 페이지에 함께 나오는 표현을 반영한다.
    terms = list(dict.fromkeys(t for t in terms if len(t) >= 3))
    if not terms:
        raise ValueError('관련도 검색에는 세 글자 이상의 표현이 필요합니다. 짧은 표현은 search로 찾으세요.')
    query = ' OR '.join('"' + t.replace('"', '""') + '"' for t in terms)
    sql = """SELECT p.source,p.n,p.key,snippet(passages,0,'[',']','…',28)
        FROM passages JOIN pages p ON p.rowid=passages.rowid
        WHERE passages MATCH ? AND instr(p.source,?)>0 ORDER BY rank LIMIT ?"""
    for source, n, key, fragment in db.execute(sql, (query, scope, limit)):
        print(f'{source} · {n}쪽 · {key}\n  {fragment.strip()}')


def related(db, text):
    words = set(re.findall(r'[가-힣]{2,}|[a-z]{3,}', text.casefold()))
    if not words:
        raise ValueError('장면의 어휘를 입력하세요.')
    scores = Counter()
    for word in words:
        for name, weight in db.execute('SELECT name,weight FROM context_terms WHERE word=?', (word,)):
            scores[name] += weight
    for name, score in scores.most_common(12):
        print(f'{score:6.1f}  {name}')
    if not scores:
        print('일치하는 문맥 어휘가 없습니다. search로 원문 표현을 확인하세요.')


def lesson(db, args):
    roster = data('install/directory.json')
    agent = roster['요원'].get(args.name)
    if not agent:
        raise ValueError(f'명부에서 인물을 찾을 수 없습니다: {args.name}')
    english = agent['english']
    orgs = [name for name, row in roster['조직'].items() if agent['affiliation'] in (name, row.get('code'))]
    relations = data('people/relations-base.json')
    print('명부 src/data/install/directory.json · 요원/', args.name)
    print(json.dumps(agent, ensure_ascii=False))
    print('호칭 src/data/people/address.json')
    print(json.dumps(data('people/address.json')['names'].get(args.name), ensure_ascii=False))
    print('관계 src/data/people/relations-base.json · 방향별 원문')
    for pair, row in relations['pairs'].items():
        if args.name in pair.split('>'):
            print(pair, row['src'] if 'src' in row else json.dumps(row, ensure_ascii=False))
    print('요원 로어 src/data/world/agents.json · 말투 원문')
    print(data('world/agents.json')['records'][args.name]['fields'].get('voice', ''))
    cues = [args.name, english, *orgs, *args.topic]
    for org in orgs:
        record = data('world/orgs.json')['records'].get(org, {})
        for field in ('intro', 'doctrine', 'recruitment'):
            if field in record.get('fields', {}):
                print(f'{org} · src/data/world/orgs.json · {field}\n{record["fields"][field]}')
    for scope in ('카드/원본_봇카드.jpeg!module.risum', 'world/orgs.json', '카드/wiki-base.json',
                  'world/greetings.json', 'world/scenes.json'):
        print(f'관련 근거 · {scope}')
        recall(db, cues, scope, 2)
    print('공통 RP 근거: read --source 지침/RP지침.txt')
    print('인물·세력·상대 관계와 현장 지식은 각 원문에서 대조한다. 관련도는 발화자나 목격자를 확정하지 않는다.')
    print('기존 퍼메 전문 (example ID)')
    for key, kind, name, title, body, _ in examples('ko'):
        if name == args.name or (kind == '공용' and key.split('-')[0] in agent.get('roster_for', [])) or english + '_' in body:
            print(key, name, title)
    print('복기: 이 인물이 지금 여기에 있는 이유는? 누구에게 어느 말투를 쓰는가? 그 상대는 무엇을 직접 보았는가?')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='cmd', required=True)
    sub.add_parser('build', help='전체 자료를 다시 읽고 색인·무결성 확인')
    sub.add_parser('verify', help='현재 원본 전체와 저장한 색인을 대조')
    ent = sub.add_parser('entry', help='지정한 인물·세력·괴이 등의 현재 설정과 위키 전문')
    ent.add_argument('name')
    sub.add_parser('status', help='독해 진도')
    files = sub.add_parser('files', help='파일과 카드 내부 에셋의 경로·크기·해시')
    files.add_argument('path', nargs='?', default='')
    r = sub.add_parser('read', help='미독 원문 한 쪽 또는 특정 페이지 전문')
    r.add_argument('key', nargs='?')
    r.add_argument('--source', default='')
    r.add_argument('--page', type=int, help='정확한 --source 안의 쪽 번호')
    s = sub.add_parser('search', help='원문 검색. 결과에서 페이지 키를 read에 전달')
    s.add_argument('term')
    s.add_argument('--source', default='')
    s.add_argument('--limit', type=int, default=15)
    s.add_argument('--offset', type=int, default=0)
    recall_cmd = sub.add_parser('recall', help='전체 원문에 맞춘 BM25 관련 구절 회수')
    recall_cmd.add_argument('terms', nargs='+')
    recall_cmd.add_argument('--source', default='')
    recall_cmd.add_argument('--limit', type=int, default=8)
    rel = sub.add_parser('related', help='장면 어휘에서 함께 쓰인 인물·세력·괴이 후보 회수')
    rel.add_argument('text')
    lesson_cmd = sub.add_parser('lesson', help='인물, 관련 세력, 말투·관계·작품을 함께 복습')
    lesson_cmd.add_argument('name')
    lesson_cmd.add_argument('topic', nargs='*')
    m = sub.add_parser('remember', help='실제로 읽은 페이지에 근거·해석 메모 저장')
    m.add_argument('key')
    m.add_argument('note')
    sub.add_parser('notes', help='현재 판 원문에 연결된 독해 메모 복습')
    st = sub.add_parser('style', help='공용 또는 인물별 기존 퍼메의 분량·형식 비교')
    st.add_argument('group', choices=['인물','공용'])
    st.add_argument('--draft', type=Path)
    ex = sub.add_parser('example', help='제목·시작 로어와 퍼메 전문 출력')
    ex.add_argument('id')
    ex.add_argument('--structure', action='store_true', help='각 문단의 형식·길이 옆에 원문 표시')
    for p in (ex,st):
        p.add_argument('--lang', choices=['ko','en'], default='ko')
    args = parser.parse_args()
    if args.cmd == 'entry':
        return entry(args.name)
    if args.cmd == 'style':
        return style(args)
    if args.cmd == 'example':
        return show_example(args)
    if args.cmd != 'build' and not CACHE.is_file():
        parser.error('먼저 build를 실행하세요.')
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(CACHE) as db:
        if args.cmd == 'build':
            build(db)
        elif args.cmd == 'verify':
            verify(db)
        elif args.cmd == 'files':
            for row in db.execute('SELECT * FROM files WHERE instr(source,?)>0 ORDER BY source', (args.path,)):
                print(*row, sep='\t')
        elif args.cmd == 'read':
            read(db,args)
        elif args.cmd == 'search':
            search(db,args)
        elif args.cmd == 'recall':
            recall(db, args.terms, args.source, args.limit)
        elif args.cmd == 'related':
            related(db, args.text)
        elif args.cmd == 'lesson':
            lesson(db, args)
        elif args.cmd == 'remember':
            if not args.note.strip() or not db.execute('SELECT 1 FROM pages WHERE key=?',(args.key,)).fetchone():
                raise ValueError('현재 판의 페이지 키와 독해 메모가 필요합니다.')
            db.execute('INSERT OR REPLACE INTO notes VALUES (?,?)',(args.key,args.note.strip()))
        elif args.cmd == 'notes':
            for row in db.execute('SELECT source,n,note FROM pages JOIN notes USING(key) ORDER BY source,n'):
                print(*row,sep='\t')
        else:
            status(db)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, sqlite3.Error, zipfile.BadZipFile, KeyError) as exc:
        sys.exit(str(exc))
