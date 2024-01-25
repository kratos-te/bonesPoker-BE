import { getKnex } from "../knex";
import { UserProfile } from "src/types/UserProfile";
const knex = getKnex();

export const defaultUserPfps = [
    "/img/avatars/1.png"
]

export const getUserProfileData = async (address: string) => {
    let data = await knex<UserProfile>("users").select().where({ address });
    if (data.length > 0) {
        return data[0];
    } else {
        let dataTmp = await insertUser({ address, pfp: defaultUserPfps[0] });
        return dataTmp;
    }
}

export const saveUserProfileData = async (address: string, pfpData: Partial<UserProfile>) => {
    let result = await knex<UserProfile>("users").update(pfpData).where({ address });
    console.log("update users result >> ", result);
    return true;
}

async function insertUser(args: Partial<UserProfile>): Promise<UserProfile> {
    const [user] = await knex<UserProfile>("users").insert(
        {
            ...args,
        },
        "*"
    );
    return user;
}