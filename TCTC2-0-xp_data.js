// TCTC2-0-xp_data.js — XP / 等級系統設定檔
// 給 firebase.js（寫入 XP）跟 xp_display.js（顯示等級）共用，需先載入

const XP_CONFIG = {
    actions: {
        stage_clear: 8,
        stage_first_clear: 35,
        chars_per_xp: 20,
        challenge_points_multiplier: 3,
        achievement_tier: {
            bronze: 20,
            silver: 50,
            gold: 100,
            platinum: 200
        },
        daily_login: 20
    },

    // 分級固定門檻：每個區間內每級 XP 一樣，跨區間逐段加重（避免單一斷崖式跳躍）
    level_tiers: [
        { from: 1,  to: 10, xp_per_level: 100 },
        { from: 11, to: 20, xp_per_level: 250 },
        { from: 21, to: 30, xp_per_level: 500 },
        { from: 31, to: 40, xp_per_level: 750 },
        { from: 41, to: 50, xp_per_level: 1000 }
    ],

    max_level: 50
}

let _XP_LEVEL_COST_TABLE = null
let _XP_CUMULATIVE_TABLE = null

function XP_Build_Level_Tables(){
    if(_XP_LEVEL_COST_TABLE && _XP_CUMULATIVE_TABLE) return

    const costTable = []
    for(let level = 1; level <= XP_CONFIG.max_level; level++){
        const tier = XP_CONFIG.level_tiers.find(function(t){
            return level >= t.from && level <= t.to
        })
        costTable[level] = tier
            ? tier.xp_per_level
            : XP_CONFIG.level_tiers[XP_CONFIG.level_tiers.length - 1].xp_per_level
    }

    const cumulativeTable = [0]
    for(let level = 1; level <= XP_CONFIG.max_level; level++){
        cumulativeTable[level] = cumulativeTable[level - 1] + costTable[level]
    }

    _XP_LEVEL_COST_TABLE = costTable
    _XP_CUMULATIVE_TABLE = cumulativeTable
}

function XP_Get_Level(xp){
    XP_Build_Level_Tables()
    const value = (typeof xp === "number" && !isNaN(xp)) ? xp : 0

    let level = 0
    for(let i = 1; i <= XP_CONFIG.max_level; i++){
        if(value >= _XP_CUMULATIVE_TABLE[i]) level = i
        else break
    }
    return level
}

function XP_Get_Level_Progress(xp){
    XP_Build_Level_Tables()
    const value = (typeof xp === "number" && !isNaN(xp)) ? xp : 0
    const level = XP_Get_Level(value)

    if(level >= XP_CONFIG.max_level){
        const needed = _XP_LEVEL_COST_TABLE[XP_CONFIG.max_level]
        return { level: level, current: needed, needed: needed, percent: 100 }
    }

    const needed = _XP_LEVEL_COST_TABLE[level + 1]
    const current = value - _XP_CUMULATIVE_TABLE[level]
    const percent = needed > 0 ? Math.round((current / needed) * 100) : 0
    return { level: level, current: current, needed: needed, percent: percent }
}