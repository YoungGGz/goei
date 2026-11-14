// 시험 미리 넣기 (npm test 의 --import): 본체는 부팅 때 세계 자료 팩을 먼저 넣고 시작한다. 시험마다 따로 묶은 모듈도 같은 상태로 시작하게
// 세계 자료(goei-data-world 글)를 globalThis 에 둔다. src/core/world/records.ts 가 처음 불릴 때 이것을 쓴다 (넣은 뒤에는 setWorldData 가 이긴다)
import { worldPackText } from '../scripts/data-pack.mjs';

globalThis.__goeiWorldData = JSON.parse(worldPackText());
