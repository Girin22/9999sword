# 데이터 매니페스트 — `data/*.json`

모든 게임 수치는 여기서 온다. 코드는 이 파일들을 import해서 쓰고, 밸런스 조정은 JSON만 바꾼다. 각 파일의 `$comment`도 스펙의 일부다.

| 파일 | 내용 | 주 소비자 |
|---|---|---|
| `constants.json` | 화면, 강화 확률·비용·곡선, 장인의 기운, 무게 계수, 병종 상수, 적합도 표, 기절·침상·광산·아바타·성벽·웨이브 상수, 피해 공식 | `sim/forge.ts`, `sim/combat.ts`, `sim/wave.ts` |
| `units.json` | 유닛 7종(체력·방어·식량·고유 옵션·해금), 병종 정의, 시작 해금 | `sim/units.ts`, `scenes/Formation` |
| `swords.json` | 검 종류 9(무게·카테고리·고유 옵션), 굴림 풀, 쇠한 검 | `sim/forge.ts`, `sim/swordStats.ts` |
| `traits.json` | 특성 31 + 나 강림(축·티어·형태·계승·효과 파라미터), 시작 풀 | `sim/traits/*`, `sim/forge.ts` |
| `monsters.json` | 잡몹 4·거대 4(스탯·행동·성벽 초수·고유 행동·드롭·에셋 키), 스테이지 배율 | `sim/monsters.ts`, `sim/wave.ts` |
| `stages.json` | 스테이지 S1~S3·무한(식량 제한·웨이브 구성·레시피 목록·보상·해금), 레시피 드롭 확률 | `sim/wave.ts`, `scenes/Lobby`, `scenes/Result` |
| `growth.json` | 성장 상점 항목·단계·가격 | `scenes/Lobby`, `sim/save.ts` |
| `options.json` | 부가 옵션 줄(12종·시작 풀·줄 수 상한·옵션/모루 레시피 id) | `sim/forge.ts`, `sim/swordStats.ts` |

## 파생 계산 (코드에서 하는 것)

### 검 → 실제 스탯 (`sim/swordStats.ts`)
```
kind = swords.kinds[sword.kind]; fit = constants.fitness[unit.class][kind.category]
baseAtk = sword === SCRAP ? scrapAtk : (10 + 4N) × 1.1^floor(N/10)
atk = baseAtk × fit.mult × (kind.options.atkMult ?? 1) × unitOption(atkBonus) × traitAtkMult
weight = clamp(kind.weight + trait.weightAdd, 0, 4); 대거므+대검이면 1
attackInterval = classBase.attackInterval × (1 + 0.25·weight) / (kind.attackSpeedMult ?? 1) / traitAttackSpeed / unitOption
moveSpeed = classBase.moveSpeed / (1 + 0.15·weight)
range = classBase.range × (kind.options.rangeMult ?? 1) × traitRangeMult   (fit.optionsActive=false면 rangeMult 무시)
hits, hitMult, shape, pierce, defIgnore, critChance(base 0.05 + add), critDamage(base 1.5 + add)
buffStrength(마검사) = atk / 10 (%) × kind.buffEffectMult × 호테 +30%p(디버프만)
```
`fit.optionsActive === false`면 종류 고유 옵션과 특성의 버프/디버프 축을 발현하지 않는다(공격력 배율만 적용).

### 피해 (`sim/combat.ts`)
```
defEff = max(0, target.def × defMult(단련·저주) × (1 − attacker.defIgnore))
dmg = atk × 100 / (100 + defEff) × (1 − target.damageReduction)   // 떼까이 0.30, 보호막 1.0
치명타: dmg × critDamage ; 타격 수만큼 반복(각 hitMult)
```

### 장인의 기운 (`sim/forge.ts`)
```
클릭마다: spiritCounter += 1
if spiritCounter >= pityClicks+1  → 발동 확정
else if rng < perClickChance      → 발동
발동 시: spiritCounter = 0; axis = rng < orderRatio ? order : chaos
  order이고 rng < avatarChanceWithinOrder → 'avatar'
  else tier = tierByForgeLevel 롤 → pool(axis, tier) 중 랜덤(장인의 기억 가중)
  sword.trait = 선택 (기존 특성 삭제)
```
검증값: perClickChance 0.0127 → 10클릭 내 발동 ≈ 12%, 평균 10.3클릭/특성.

### 형상 (`sim/forge.ts`)
```
클릭마다 shapeCounter += 1; if shapeCounter === 5 → shapeCounter = 0, sword.kind = rerollPool 롤,
  부가 옵션 한 줄 롤(options.json: 빈 줄 있으면 push, 다 찼으면 랜덤 교체, 같은 stat 중복 금지; 줄 수 상한 = save.lines)
보급 시 새 검: n=0, kind=basic, trait=null, shapeCounter=0, spiritCounter 유지
```

### 성벽 (`sim/wave.ts`)
```
wall.max = constants.wall.hpBase × growth.wallLevel
giant.wallDps = wall.max / (giant.wallSeconds × stage.wallSecondsMult × loopMult)
잡몹은 성벽 무피해. 웨이브 클리어 시 wall.hp += wall.max × 0.30 (max 초과 불가)
```

### 보상 (`scenes/Result`)
```
클리어: shards = fixed + randInt(0..randomMax); 레시피: rng < 0.60 → 미보유 후보 중 랜덤, 없으면/보유면 +20 shards
실패: shards = failPerWave × 도달 웨이브 수
```

## 저장 스키마 (`sim/save.ts`, localStorage key `fk_save_v1`)
```json
{
  "version": 1,
  "shards": 0,
  "growth": { "enhancePerClick": 0, "forgeLevel": 0, "beds": 0, "stunCooldown": 0, "mineSlots": 0, "wallLevel": 0, "artisanMemory": 0, "forgeBias": 0 },
  "unitUpgrades": { "ireukkun": 0, "ttekkai": 0, "daegeomeu": 0, "hareubang": 0, "podong": 0, "dongki": 0, "hote": 0 },
  "avatars": ["demigod"],
  "relics": [],
  "unlockedUnits": ["ireukkun", "ttekkai", "hareubang", "dongki"],
  "recipes": [],
  "optionRecipes": [],
  "lines": 2,
  "cleared": { "S1": false, "S2": false, "S3": false },
  "infLoop": 0,
  "lastFormation": { "units": [], "miner": null },
  "sound": true
}
```
`growth.*`는 `growth.json` levels 인덱스. 초기화 = 키 삭제.

## 에셋 키 (M6에서 사용, 없으면 플레이스홀더)
- 유닛 리그: `body_{unitId}` 7장(팔 없음), `hand`(공용 원, 틴트), `body_avatar`, `halo`. 무기·방패·깃발·곡괭이는 `hand_R`/`hand_L`/`back` 소켓에 부착(피벗 = 손잡이)
- 몬스터: `mob_{calf|harpy|satyr|hoplite}`(전체 한 장), `giant_{hermes|poseidon|hephaestus|zeus}`(전체 한 장, 768²)
- 검: `sword_{kindId}_{1|2|3}` (단계 = +N 0~9 / 10~29 / 30+), `sword_scrap`
- 소품: `shield`, `flag_buff`, `flag_debuff`, `halo`, `pickaxe`, `parcel`, `tube`, `trident`, `hammer`, `beard`, `bolt`, `roundShield`
- 발사체: `proj_swordWave`, `proj_spearWave`, `proj_jar`, `proj_bolt`
- 건물(아이소메트릭 카드용): `bld_forge`, `bld_barracks`, `bld_mine` / 성벽: `wall_tile`, `wall_gate` / 맵: `tile_grass`, `tile_road`
- 이펙트: `fx_hit`, `fx_order`, `fx_chaos`, `fx_breakthrough`, `fx_descend`
