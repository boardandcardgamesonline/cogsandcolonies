/**
 * Cogs and Colonies — A Steampunk D6 TTRPG System for Foundry VTT
 */

// ==============================
// CONSTANTS
// ==============================

const CC = {
  HEALTH_TRACKS: {
    standard: ["Healthy", "Lightly Wounded", "Moderately Wounded", "Severely Wounded", "Disfigured", "Dead"],
    soldier: ["Healthy", "Lightly Wounded", "Lightly Wounded 2", "Moderately Wounded", "Moderately Wounded 2",
              "Severely Wounded", "Severely Wounded 2", "Disfigured", "Dead"],
    large: ["Healthy", "LW", "LW 2", "LW 3", "MW", "MW 2", "MW 3", "MW 4",
            "SW", "SW 2", "SW 3", "Disfigured", "Dead"]
  },
  KEYWORDS: {
    "armor-piercing": "Deals 1 wound level before hitting durability",
    "area": "Hits multiple targets in zone",
    "sundering": "Deals double damage to armor durability",
    "crippling": "Halves movement speed until healed",
    "nonlethal": "Knocks target unconscious instead of Disfigured/Dead",
    "grappled": "Cannot move. Athletics 4+ to break free",
    "knocked-prone": "Must spend movement action to stand up",
    "blinded": "-1 to next attack roll",
    "weakened": "-1 to next damage roll",
    "poisoned": "1d6 damage on next turn",
    "burning": "1d6 damage on next turn",
    "silenced": "Cannot form intent for one turn"
  },
  SIGILS_T1: ["Life", "Death", "Fire", "Water", "Earth", "Air"],
  SIGILS_T2: {
    "Fire+Death": { name: "Ash", naturalIntent: "Burn" },
    "Water+Death": { name: "Poison", naturalIntent: "Poison" },
    "Air+Death": { name: "Miasma", naturalIntent: "Poison" },
    "Earth+Death": { name: "Bone", naturalIntent: "Pierce" },
    "Life+Death": { name: "Necromancy", naturalIntent: "Siphon" },
    "Earth+Life": { name: "Metal", naturalIntent: "Rend" },
    "Water+Life": { name: "Blood", naturalIntent: "Cleanse" },
    "Fire+Life": { name: "Spirit", naturalIntent: "Heal" },
    "Air+Life": { name: "Weather", naturalIntent: "Slow" },
    "Fire+Earth": { name: "Magma", naturalIntent: "Explode" },
    "Fire+Water": { name: "Steam", naturalIntent: "Burn" },
    "Fire+Air": { name: "Lightning", naturalIntent: "Rend" },
    "Earth+Water": { name: "Mud", naturalIntent: "Slow" },
    "Earth+Air": { name: "Sand", naturalIntent: "Blind" },
    "Water+Air": { name: "Ice", naturalIntent: "Pierce" }
  },
  INTENTS_T1: ["Strike","Explode","Burn","Heal","Pierce","Push","Pull","Slow","Blind",
               "Weaken","Strengthen","Deflect","Propel","Reveal","Detect","Mend"],
  INTENTS_T2: ["Absorb","Protect","Charm","Imprint","Siphon","Cleanse","Silence","Cloak",
               "Corrode","Freeze","Infect","Conceal","Bypass","Track","Nullify","Anchor",
               "Immobilize","Rend"],
  ARMOR_TYPES: {
    "none":         { durability: 0,  movement: 40, label: "No Armor" },
    "shield":       { durability: 10, movement: 0,  label: "Shield" },
    "light":        { durability: 12, movement: 35, label: "Light Armor" },
    "medium":       { durability: 18, movement: 30, label: "Medium Armor", penalties: ["-1 Stealth"] },
    "heavy":        { durability: 24, movement: 25, label: "Heavy Armor", penalties: ["-1 Stealth","-1 Footwork","-1 Athletics","-1 Dodge"] },
    "mage":         { durability: 32, movement: 20, label: "Mage Armor", penalties: ["-2 Stealth","-2 Athletics","-2 Footwork","-2 Dodge","Cannot Run"] },
    "mage-killer":  { durability: 28, movement: 25, label: "Mage-Killer Armor", penalties: ["Cannot Dodge","-1 Magic Damage"] }
  }
};

// ==============================
// SYSTEM INITIALIZATION
// ==============================

Hooks.once("init", async function () {
  console.log("Cogs and Colonies | Initializing system");

  CONFIG.Combat.initiative = { formula: "2d6 + @skills.perception.rank", decimals: 0 };

  // Register actor/item sheet classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("cogs-and-colonies", CnCCharacterSheet, { types: ["character"], makeDefault: true, label: "Character Sheet" });
  Actors.registerSheet("cogs-and-colonies", CnCNPCSheet, { types: ["npc"], makeDefault: true, label: "NPC / Creature Sheet" });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("cogs-and-colonies", CnCItemSheet, { makeDefault: true, label: "Item Sheet" });

  // Register system settings
  game.settings.register("cogs-and-colonies", "critAutoExplode", {
    name: "Critical hits auto-add 1d6",
    hint: "On a natural 6, automatically roll and add 1d6 to damage.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register("cogs-and-colonies", "showKeywordDetails", {
    name: "Show keyword tooltips in chat",
    scope: "world", config: true, type: Boolean, default: true
  });

  // Make CC config globally accessible
  game.cnc = { CC, rollAttack, rollDamage, rollInitiative };
});

Hooks.once("ready", function () {
  console.log("Cogs and Colonies | System ready");
});

// ==============================
// DICE MECHANICS
// ==============================

/**
 * Roll an attack check against DC 4+
 * @param {number} modifier — bonus/penalty to roll
 * @param {string} label — chat label
 */
async function rollAttack(modifier = 0, label = "Attack", actor = null) {
  const roll = new Roll("1d6");
  await roll.evaluate();
  const die = roll.total;
  const total = die + modifier;
  const isCrit = die === 6;
  const isSuccess = total >= 4;
  const isFailure = total < 4;

  const resultLabel = isCrit ? "CRITICAL HIT!" : isSuccess ? "Hit" : "Miss";
  const resultClass = isCrit ? "cnc-crit" : isSuccess ? "cnc-success" : "cnc-failure";

  const html = `
    <div class="cnc-roll-card">
      <div class="cnc-roll-header">${label}</div>
      <div class="cnc-roll-dice">🎲 ${die}${modifier !== 0 ? ` + (${modifier})` : ""} = <strong>${total}</strong></div>
      <div class="cnc-roll-result ${resultClass}">${resultLabel}</div>
      ${modifier !== 0 ? `<div class="cnc-roll-modifier">Modifier: ${modifier >= 0 ? "+" : ""}${modifier}</div>` : ""}
      ${isCrit ? `<div class="cnc-roll-crit-note">Roll +1d6 bonus damage!</div>` : ""}
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : {},
    content: html,
    type: CONST.CHAT_MESSAGE_TYPES?.ROLL ?? 0,
    roll: roll
  });

  return { die, total, isSuccess, isCrit };
}

/**
 * Roll damage dice
 * @param {string} formula — e.g. "2d6", "1d6"
 * @param {string[]} keywords — active keywords for this attack
 * @param {boolean} isCrit — whether to add crit bonus die
 * @param {string} label
 */
async function rollDamage(formula = "1d6", keywords = [], isCrit = false, label = "Damage", actor = null) {
  const critBonus = isCrit && game.settings.get("cogs-and-colonies", "critAutoExplode") ? " + 1d6" : "";
  const roll = new Roll(formula + critBonus);
  await roll.evaluate();

  const keywordTags = keywords.map(k =>
    `<span class="cnc-keyword" title="${CC.KEYWORDS[k] || k}">${k.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>`
  ).join(" ");

  const html = `
    <div class="cnc-roll-card cnc-damage-card">
      <div class="cnc-roll-header">${label} — Damage</div>
      <div class="cnc-roll-dice">💥 <strong>${roll.total}</strong> ${formula}${critBonus ? " (+ Crit d6)" : ""}</div>
      ${keywords.length ? `<div class="cnc-keywords">${keywordTags}</div>` : ""}
      ${keywords.includes("armor-piercing") ? `<div class="cnc-keyword-note">⚠ Armor Piercing: Deals 1 wound level before hitting durability</div>` : ""}
      ${keywords.includes("sundering") ? `<div class="cnc-keyword-note">⚠ Sundering: Double damage to armor durability</div>` : ""}
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : {},
    content: html
  });

  return roll.total;
}

/**
 * Roll initiative: 2d6 + Perception rank
 */
async function rollInitiative(perception = 0, actor = null) {
  const roll = new Roll(`2d6 + ${perception}`);
  await roll.evaluate();
  return roll.total;
}

// ==============================
// CHARACTER SHEET
// ==============================

class CnCCharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cnc", "sheet", "character"],
      template: "systems/cogs-and-colonies/templates/character-sheet.html",
      width: 800,
      height: 900,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "core" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;
    data.config = CC;
    data.healthStates = CC.HEALTH_TRACKS[data.system.health?.track || "standard"];
    data.armorTypes = CC.ARMOR_TYPES;
    data.sigils = CC.SIGILS_T1;
    data.isGM = game.user.isGM;

    // Compute experience remaining
    data.expRemaining = (data.system.experience?.total || 0) - (data.system.experience?.spent || 0);

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Roll attack
    html.find(".cnc-roll-attack").on("click", async (e) => {
      const modifier = parseInt(e.currentTarget.dataset.modifier || 0);
      const label = e.currentTarget.dataset.label || "Attack";
      await rollAttack(modifier, label, this.actor);
    });

    // Roll damage
    html.find(".cnc-roll-damage").on("click", async (e) => {
      const formula = e.currentTarget.dataset.formula || "1d6";
      const keywords = (e.currentTarget.dataset.keywords || "").split(",").filter(Boolean);
      const label = e.currentTarget.dataset.label || "Attack";
      const result = await rollAttack(0, label, this.actor);
      if (result.isSuccess) {
        await rollDamage(formula, keywords, result.isCrit, label, this.actor);
      }
    });

    // Initiative roll
    html.find(".cnc-roll-initiative").on("click", async () => {
      const perception = this.actor.system.skills?.perception?.rank || 0;
      const total = await rollInitiative(perception, this.actor);
      ChatMessage.create({
        content: `<div class="cnc-roll-card"><div class="cnc-roll-header">Initiative</div><div class="cnc-roll-dice">🎲 <strong>${total}</strong> (2d6 + ${perception} Perception)</div></div>`,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      });
    });

    // Skill check
    html.find(".cnc-skill-check").on("click", async (e) => {
      const skillName = e.currentTarget.dataset.skill;
      const rank = parseInt(e.currentTarget.dataset.rank || 0);
      await this._rollSkillCheck(skillName, rank);
    });

    // Health track click
    html.find(".cnc-health-pip").on("click", (e) => {
      const state = e.currentTarget.dataset.state;
      this.actor.update({ "system.health.current": state });
    });

    // Editable fields
    if (this.isEditable) {
      html.find(".cnc-inline-edit").on("change", (e) => {
        const field = e.currentTarget.dataset.field;
        const value = e.currentTarget.type === "checkbox" ? e.currentTarget.checked :
                      e.currentTarget.type === "number" ? parseInt(e.currentTarget.value) || 0 :
                      e.currentTarget.value;
        this.actor.update({ [field]: value });
      });

      // Skill rank pips
      html.find(".cnc-skill-pip").on("click", (e) => {
        const path = e.currentTarget.dataset.path;
        const rank = parseInt(e.currentTarget.dataset.rank);
        const current = foundry.utils.getProperty(this.actor.system, path.replace("system.", ""));
        const newRank = current === rank ? rank - 1 : rank;
        this.actor.update({ [path]: Math.max(0, newRank) });
      });

      // Drag-drop items
      html.find(".cnc-item-delete").on("click", (e) => {
        const itemId = e.currentTarget.closest("[data-item-id]")?.dataset.itemId;
        if (itemId) this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      });
    }
  }

  async _rollSkillCheck(skillName, rank) {
    const roll = new Roll("1d6");
    await roll.evaluate();
    const die = roll.total;
    const label = skillName.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());

    // Rank bonuses: rank 1 = reroll 1s, rank 2 = +1, rank 3 = roll 2d6
    let note = "";
    if (rank >= 3) note = "Rank 3: Rolled 2d6, took higher";
    if (rank >= 2) note = "Rank 2: +1 to roll";

    const modified = rank >= 2 ? die + 1 : die;
    const isSuccess = modified >= 4;

    const html = `
      <div class="cnc-roll-card">
        <div class="cnc-roll-header">${label} Check (Rank ${rank})</div>
        <div class="cnc-roll-dice">🎲 ${die}${rank >= 2 ? " + 1" : ""} = <strong>${modified}</strong></div>
        <div class="cnc-roll-result ${isSuccess ? "cnc-success" : "cnc-failure"}">${isSuccess ? "Success (4+)" : "Failure"}</div>
        ${note ? `<div class="cnc-roll-modifier">${note}</div>` : ""}
      </div>
    `;

    ChatMessage.create({ content: html, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
  }
}

// ==============================
// NPC SHEET
// ==============================

class CnCNPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cnc", "sheet", "npc"],
      template: "systems/cogs-and-colonies/templates/npc-sheet.html",
      width: 680,
      height: 720,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;
    data.config = CC;
    data.healthStates = CC.HEALTH_TRACKS[data.system.health?.track || "standard"];
    data.isGM = game.user.isGM;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".cnc-roll-attack").on("click", async (e) => {
      const modifier = parseInt(e.currentTarget.dataset.modifier || 0);
      const label = e.currentTarget.dataset.label || "Attack";
      await rollAttack(modifier, label, this.actor);
    });

    html.find(".cnc-roll-damage").on("click", async (e) => {
      const formula = e.currentTarget.dataset.formula || "1d6";
      const keywords = (e.currentTarget.dataset.keywords || "").split(",").filter(Boolean);
      const label = e.currentTarget.dataset.label || "Attack";
      const result = await rollAttack(0, label, this.actor);
      if (result.isSuccess) {
        await rollDamage(formula, keywords, result.isCrit, label, this.actor);
      }
    });

    html.find(".cnc-health-pip").on("click", (e) => {
      const state = e.currentTarget.dataset.state;
      this.actor.update({ "system.health.current": state });
    });

    html.find(".cnc-armor-current").on("change", (e) => {
      this.actor.update({ "system.armor.durability.value": parseInt(e.target.value) || 0 });
    });

    if (this.isEditable) {
      html.find(".cnc-inline-edit").on("change", (e) => {
        const field = e.currentTarget.dataset.field;
        const value = e.currentTarget.type === "number" ? parseInt(e.currentTarget.value) || 0 : e.currentTarget.value;
        this.actor.update({ [field]: value });
      });
    }
  }
}

// ==============================
// ITEM SHEET
// ==============================

class CnCItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cnc", "sheet", "item"],
      template: "systems/cogs-and-colonies/templates/item-sheet.html",
      width: 520,
      height: 480,
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.item.system;
    data.config = CC;
    data.keywords = Object.entries(CC.KEYWORDS).map(([k, v]) => ({ id: k, label: k.replace(/-/g, " "), desc: v }));
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".cnc-keyword-toggle").on("click", (e) => {
      const kw = e.currentTarget.dataset.keyword;
      const current = this.item.system.keywords || [];
      const updated = current.includes(kw) ? current.filter(k => k !== kw) : [...current, kw];
      this.item.update({ "system.keywords": updated });
    });
  }
}

// ==============================
// COMBAT HOOKS
// ==============================

Hooks.on("renderChatMessage", (message, html) => {
  // Style keyword tooltips
  html.find(".cnc-keyword").on("click", (e) => {
    const tip = e.currentTarget.title;
    ui.notifications.info(tip);
  });
});

// Override initiative roll to use 2d6
Hooks.on("createCombatant", async (combatant) => {
  const actor = combatant.actor;
  if (!actor) return;
  const perception = actor.system?.skills?.perception?.rank || 0;
  const roll = new Roll(`2d6 + ${perception}`);
  await roll.evaluate();
  await combatant.update({ initiative: roll.total });
});
