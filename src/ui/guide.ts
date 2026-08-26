/**
 * Desktop-only side guide rendered in the letterbox area around the 9:16 canvas.
 * Left panel: how the game loop works. Right panel: what every button does.
 * Hidden automatically on portrait / narrow viewports (see style.css) — phones never see it.
 */
export type GuideKey = 'lobby' | 'formation' | 'battle';

interface GuideSection { title: string; items: { label: string; text: string; icon?: string }[] }
interface GuideContent { heading: string; loop: GuideSection; buttons: GuideSection }

const CONTENT: Record<GuideKey, GuideContent> = {
  battle: {
    heading: '전투 가이드',
    loop: {
      title: '게임은 이렇게 돌아가요',
      items: [
        { icon: '⛏', label: '① 재료 모으기', text: '광산 담당 병사가 자동으로 금광석을 캐고, 적을 잡아도 떨어집니다.' },
        { icon: '🔨', label: '② 검 강화', text: '대장간에서 재료를 써서 검을 +1씩 올립니다. 대장간 검은 아직 아무도 안 들고 있어요.' },
        { icon: '🎁', label: '③ 보급', text: '막사에서 병종을 고르면 그 병종 전원이 대장간 검을 받습니다. 대장간은 다시 +0부터.' },
        { icon: '🏰', label: '④ 성벽 방어', text: '몹 → 거인(보스) 순서로 웨이브가 옵니다. 성벽 체력이 0이 되면 패배, 마지막 보스를 잡으면 승리.' },
      ],
    },
    buttons: {
      title: '버튼 설명',
      items: [
        { icon: '🔨', label: '대장간 › 강화하기', text: '재료를 소모해 검 +1 (대성공 +2). 버튼에 성공 확률이 보이고, 성공이 3번 쌓일 때마다 10%씩 내려갑니다. 보급하면 다시 올라와요.' },
        { icon: '✨', label: '대장간 › 장인의 기운', text: '건물 아래 10칸 게이지. 강화할 때마다 차오르고, 다 차면 검에 질서(파랑) 또는 혼돈(빨강) 특성이 붙습니다.' },
        { icon: '♜➶⚑', label: '막사 › 병종 버튼', text: '기사 / 투척병 / 마검사. 누르면 그 병종 전원이 전투를 멈추고 성벽까지 달려와 대장간 검으로 바꿔 듭니다. 아래 숫자는 그 병종의 가장 약한 검. 자물쇠가 걸린 건 이번 편성에 없는 병종이에요.' },
        { icon: '➕', label: '막사 › 치료', text: '체력 40% 이하인 병사 중 가장 위험한 한 명을 막사로 불러 완전 회복. 침상은 1개라 한 번에 한 명, 버튼 테두리가 차오르면 복귀합니다.' },
        { icon: '⛏', label: '광산', text: '담당 병사가 재료를 캡니다. 「내보내기」로 전장에 내보내고 「다시 부르기」로 광산에 되돌립니다. 광산에 있는 병사도 보급은 자동으로 받아요.' },
        { icon: '⏩', label: '×1 / ×2', text: '전투 배속.' },
        { icon: '☰', label: '메뉴', text: '일시정지, BGM, 스테이지 포기.' },
      ],
    },
  },
  lobby: {
    heading: '마을 가이드',
    loop: {
      title: '여기서 하는 일',
      items: [
        { icon: '🗺', label: '스테이지 선택', text: '‹ › 로 스테이지를 넘기고 「시작」으로 입장. 이전 스테이지를 깨야 다음이 열립니다.' },
        { icon: '🍖', label: '식량', text: '편성할 수 있는 병사의 총량. 스테이지를 깰수록 늘어나고, 이전 스테이지에도 적용됩니다.' },
        { icon: '💎', label: '신의 파편', text: '전투 보상 재화. 업그레이드에 씁니다.' },
      ],
    },
    buttons: {
      title: '버튼 설명',
      items: [
        { icon: '⚔', label: '출격 준비', text: '어떤 병사를 데려갈지 편성합니다. 편성 없이 「시작」을 누르면 편성 화면으로 갑니다.' },
        { icon: '⬆', label: '업그레이드', text: '유닛 / 유틸 / 건물 탭. 파편으로 영구 성장.' },
        { icon: '📖', label: '레시피', text: '보스에게서 얻은 검 특성·옵션 도감.' },
      ],
    },
  },
  formation: {
    heading: '편성 가이드',
    loop: {
      title: '편성 규칙',
      items: [
        { icon: '👆', label: '카드 탭', text: '누를 때마다 그 병사가 1명씩 추가됩니다. 같은 병사를 여러 명 데려갈 수 있어요.' },
        { icon: '🍖', label: '식량 한도', text: '병사마다 식량 비용이 있고 합계가 한도를 넘을 수 없습니다. 한도에 가깝게 채우는 게 유리해요.' },
        { icon: '⛏', label: '광산 담당', text: '전투 시작 시 광산에 들어가는 병사. 이르꾼이 있으면 자동으로 이르꾼이 맡습니다.' },
      ],
    },
    buttons: {
      title: '버튼 설명',
      items: [
        { icon: '⛏', label: '광산 담당', text: '누를 때마다 편성된 병사 순서로 담당이 바뀝니다.' },
        { icon: '↺', label: '편성 초기화', text: '전부 비웁니다.' },
        { icon: '✓', label: '완료 / 취소', text: '완료하면 저장되고 마을로 돌아갑니다.' },
      ],
    },
  },
};

const STORAGE_KEY = 'fableknights.guide.collapsed';
let root: HTMLElement | null = null;
let current: GuideKey | null = null;

const el = (tag: string, className?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const readCollapsed = (): boolean => { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; } };
const writeCollapsed = (value: boolean): void => { try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* ignore */ } };

function ensureRoot(): HTMLElement {
  if (root) return root;
  root = el('aside', 'guide');
  root.setAttribute('aria-label', '게임 가이드');
  if (readCollapsed()) root.classList.add('collapsed');
  document.body.appendChild(root);
  return root;
}

function renderSection(section: GuideSection): HTMLElement {
  const box = el('section', 'guide-section');
  box.appendChild(el('h3', undefined, section.title));
  const list = el('ul');
  for (const item of section.items) {
    const li = el('li');
    const head = el('div', 'guide-item-head');
    if (item.icon) head.appendChild(el('span', 'guide-icon', item.icon));
    head.appendChild(el('strong', undefined, item.label));
    li.appendChild(head);
    li.appendChild(el('p', undefined, item.text));
    list.appendChild(li);
  }
  box.appendChild(list);
  return box;
}

/** Show the guide panels for a screen; call from each scene's create(). */
export function showGuide(key: GuideKey): void {
  const host = ensureRoot();
  if (current === key) return;
  current = key;
  host.replaceChildren();
  const content = CONTENT[key];

  const left = el('div', 'guide-panel guide-left');
  left.appendChild(el('h2', undefined, content.heading));
  left.appendChild(renderSection(content.loop));

  const right = el('div', 'guide-panel guide-right');
  right.appendChild(renderSection(content.buttons));

  const toggle = el('button', 'guide-toggle', host.classList.contains('collapsed') ? '가이드 보기' : '가이드 접기') as HTMLButtonElement;
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    const collapsed = host.classList.toggle('collapsed');
    writeCollapsed(collapsed);
    toggle.textContent = collapsed ? '가이드 보기' : '가이드 접기';
  });

  host.append(left, right, toggle);
  host.classList.add('visible');
}

export function hideGuide(): void {
  current = null;
  root?.classList.remove('visible');
}
