import { getKnex } from "../knex";

import { ActionHistory } from "../types/ActionHistory";
import { PlayerRank } from "../types/Player";
import { getTokenList } from "./tokens";

const knex = getKnex();

export async function recordAction(args: Partial<ActionHistory>): Promise<void> {
  await knex<ActionHistory>("actionHistory").insert({
    ...args,
  });
}

export const getDailyRankData = async (): Promise<any> => {
  try {
    let tokens = await getTokenList();
    let rankData: any = {};
    for (let token of tokens) {
      let tokenRankData = await knex.raw(`
      select users.*, coalesce(g.reward, 0) as reward, coalesce(g.gameWon, 0) as "gamesWon", coalesce(h.totalgames, 0) as "totalGames", 
      tokens.id as "payToken", tokens.name as "payTokenName", tokens.address as "payTokenAddress", tokens.decimal as "payTokenDecimal"
      from users left join 
      (select g.address, count(g.address) as gameWon, sum(coalesce(reward, 0)) as reward, "rewardToken"
                from players g 
                where reward> 0 and g."createdAt"> NOW() - interval '30 DAY' and g."createdAt" != g."updatedAt" and g."rewardToken" =${token.id}
                group by address, "rewardToken") g 
            on users.address=g.address
            left join 
            (select g.address, count(g.address) as totalgames 
      from players g 
      where g."createdAt"> NOW() - interval '30 DAY' and g."createdAt" != g."updatedAt" and g."rewardToken" =${token.id}
      group by address) h on users.address=h.address
      left join tokens on tokens.id=g."rewardToken"
      order by reward desc limit 50
      `);
      rankData[token.name] = tokenRankData.rows as PlayerRank[];
    }
    return rankData;
  } catch (e) {
    console.log('err on getDailyRankData >> ', e);
    return []
  }
}

export const getMonthlyRankData = async (): Promise<any> => {
  try {
    let tokens = await getTokenList();
    let rankData: any = {};
    for (let token of tokens) {
      let tokenRankData = await knex.raw(`
select users.*, coalesce(g.reward, 0) as reward, coalesce(g.gameWon, 0) as "gamesWon", coalesce(h.totalgames, 0) as "totalGames", 
tokens.id as "payToken", tokens.name as "payTokenName", tokens.address as "payTokenAddress", tokens.decimal as "payTokenDecimal"
from users left join 
(select g.address, count(g.address) as gameWon, sum(coalesce(reward, 0)) as reward, "rewardToken"
          from players g 
          where reward> 0 and g."createdAt"> NOW() - interval '30 DAY' and g."createdAt" != g."updatedAt" and g."rewardToken" =${token.id}
          group by address, "rewardToken") g 
		  on users.address=g.address
		  left join 
		  (select g.address, count(g.address) as totalgames 
from players g 
where g."createdAt"> NOW() - interval '30 DAY' and g."createdAt" != g."updatedAt" and g."rewardToken" =${token.id}
group by address) h on users.address=h.address
left join tokens on tokens.id=g."rewardToken"
order by reward desc limit 50
`);
      rankData[token.name] = tokenRankData.rows as PlayerRank[];
    }
    return rankData;
  } catch (e) {
    console.log('err on getDailyRankData >> ', e);
    return []
  }
}