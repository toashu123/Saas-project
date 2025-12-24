import sql from "../configs/db.js";


export const getUserCreations = async(req, res)=>{
    try{
        const {userId} = req.auth();

        const creations =  await sql `SELECT * FROM creations WHERE user_id = ${userId} ORDER BY 
        created_at DESC`

        res.json({success: true, creations});
    }
    catch(error){
        res.json({success:false, message:error.message})
    }
}

export const getPublishedCreations = async (req, res) => {
  try {
    console.log("Fetching published creations");

    const creations = await sql`
      SELECT * FROM creations WHERE publish IS TRUE ORDER BY created_at DESC
    `;

    res.json({ success: true, creations });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};


export const toggleLikeCreation = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`;

    if (!creation) {
      return res.json({ success: false, message: "Creation not found" });
    }

    let currentLikes = creation.likes || [];

    if (typeof currentLikes === "string") {
      currentLikes = currentLikes
        .replace(/[{}]/g, "")
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
    }

    const userIdStr = userId.toString();
    let updatedLikes;
    let message;

    if (currentLikes.includes(userIdStr)) {
      updatedLikes = currentLikes.filter(user => user !== userIdStr);
      message = "Creation unliked";
    } else {
      updatedLikes = [...currentLikes, userIdStr];
      message = "Creation liked";
    }
    const formattedArray = `{${updatedLikes.join(",")}}`;

    await sql`
      UPDATE creations
      SET likes = ${formattedArray}::text[]
      WHERE id = ${id}
    `;

    res.json({ success: true, message });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

