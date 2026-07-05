// Seed script - run with: npx tsx prisma/seed.ts
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "alex@mesh.me",
        username: "alexcreates",
        displayName: "Alex Rivera",
        passwordHash,
        bio: "Digital artist & creative director. Building beautiful things on the internet.",
        location: "Los Angeles, CA",
        website: "https://alexrivera.com",
        isVerified: true,
        isAdmin: true,
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "maya@mesh.me",
        username: "mayamusic",
        displayName: "Maya Chen",
        passwordHash,
        bio: "Producer, songwriter, and sound designer. Music is my language.",
        location: "Tokyo, Japan",
        isVerified: true,
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "jordan@mesh.me",
        username: "jordandev",
        displayName: "Jordan Park",
        passwordHash,
        bio: "Full-stack developer. Building the future of the web, one component at a time.",
        location: "San Francisco, CA",
        website: "https://jordanpark.dev",
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "luna@mesh.me",
        username: "lunawrites",
        displayName: "Luna Torres",
        passwordHash,
        bio: "Poet, essayist, and storyteller. Words are my medium.",
        location: "Mexico City",
        isVerified: true,
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "sam@mesh.me",
        username: "samfilms",
        displayName: "Sam Okafor",
        passwordHash,
        bio: "Filmmaker & visual storyteller. Capturing moments that matter.",
        location: "London, UK",
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "riley@mesh.me",
        username: "rileydesign",
        displayName: "Riley Kim",
        passwordHash,
        bio: "UI/UX designer with a passion for accessible, beautiful interfaces.",
        location: "Seoul, South Korea",
        isVerified: true,
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "kai@mesh.me",
        username: "kaigames",
        displayName: "Kai Nakamura",
        passwordHash,
        bio: "Game developer & streamer. Let's build worlds together.",
        location: "Portland, OR",
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "nova@mesh.me",
        username: "novaphoto",
        displayName: "Nova Williams",
        passwordHash,
        bio: "Photographer exploring the intersection of nature and urban life.",
        location: "New York, NY",
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "ash@mesh.me",
        username: "ashcooks",
        displayName: "Ash Patel",
        passwordHash,
        bio: "Chef, food stylist, and recipe developer. Cooking is creative expression.",
        location: "Mumbai, India",
        onboarded: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "demo@mesh.me",
        username: "demouser",
        displayName: "Demo User",
        passwordHash,
        bio: "Just exploring mesh.me! This is a demo account.",
        location: "The Internet",
        onboarded: true,
      },
    }),
  ]);

  const [alex, maya, jordan, luna, sam, riley, kai, nova, ash, demo] = users;

  console.log(`Created ${users.length} users`);

  // Add interests
  const interestData = [
    { userId: alex.id, tags: ["Art", "Design", "Photography", "Technology"] },
    { userId: maya.id, tags: ["Music", "Technology", "Travel", "Film"] },
    { userId: jordan.id, tags: ["Web Development", "AI", "Design", "Gaming"] },
    { userId: luna.id, tags: ["Writing", "Poetry", "Philosophy", "Travel"] },
    { userId: sam.id, tags: ["Film", "Photography", "Music", "Art"] },
    { userId: riley.id, tags: ["Design", "Art", "Technology", "Fashion"] },
    { userId: kai.id, tags: ["Gaming", "Streaming", "3D Art", "Music"] },
    { userId: nova.id, tags: ["Photography", "Nature", "Travel", "Art"] },
    { userId: ash.id, tags: ["Cooking", "Photography", "Travel", "Health"] },
    { userId: demo.id, tags: ["Music", "Art", "Technology", "Gaming"] },
  ];

  for (const { userId, tags } of interestData) {
    await prisma.userInterest.createMany({
      data: tags.map((tag) => ({ userId, tag })),
    });
  }

  // Add links
  await prisma.userLink.createMany({
    data: [
      { userId: alex.id, label: "Portfolio", url: "https://alexrivera.com" },
      { userId: alex.id, label: "Instagram", url: "https://instagram.com/alexcreates" },
      { userId: maya.id, label: "Spotify", url: "https://spotify.com/mayamusic" },
      { userId: jordan.id, label: "GitHub", url: "https://github.com/jordandev" },
      { userId: luna.id, label: "Substack", url: "https://lunawrites.substack.com" },
      { userId: sam.id, label: "YouTube", url: "https://youtube.com/samfilms" },
      { userId: riley.id, label: "Dribbble", url: "https://dribbble.com/rileydesign" },
      { userId: kai.id, label: "Twitch", url: "https://twitch.tv/kaigames" },
    ],
  });

  // Create follows (create a social graph)
  const followPairs = [
    [alex.id, maya.id], [alex.id, jordan.id], [alex.id, riley.id], [alex.id, luna.id],
    [maya.id, alex.id], [maya.id, sam.id], [maya.id, kai.id], [maya.id, luna.id],
    [jordan.id, alex.id], [jordan.id, riley.id], [jordan.id, kai.id],
    [luna.id, alex.id], [luna.id, maya.id], [luna.id, nova.id],
    [sam.id, maya.id], [sam.id, alex.id], [sam.id, nova.id],
    [riley.id, alex.id], [riley.id, jordan.id], [riley.id, nova.id],
    [kai.id, jordan.id], [kai.id, maya.id], [kai.id, sam.id],
    [nova.id, alex.id], [nova.id, sam.id], [nova.id, ash.id],
    [ash.id, nova.id], [ash.id, alex.id], [ash.id, maya.id],
    [demo.id, alex.id], [demo.id, maya.id], [demo.id, jordan.id], [demo.id, luna.id],
  ];

  await prisma.follow.createMany({
    data: followPairs.map(([followerId, followingId]) => ({ followerId, followingId })),
  });

  console.log(`Created ${followPairs.length} follows`);

  // Create communities
  const communities = await Promise.all([
    prisma.community.create({
      data: {
        name: "Creative Coders",
        slug: "creative-coders",
        description: "Where art meets code. A community for developers who love creative expression through technology.",
        category: "Technology",
        rules: "1. Be respectful\n2. Share your work\n3. Give constructive feedback\n4. No spam",
      },
    }),
    prisma.community.create({
      data: {
        name: "Sound & Vision",
        slug: "sound-and-vision",
        description: "For musicians, producers, and visual artists exploring the relationship between sound and imagery.",
        category: "Music",
        rules: "1. Share original work\n2. Credit collaborators\n3. Keep it positive",
      },
    }),
    prisma.community.create({
      data: {
        name: "Indie Filmmakers",
        slug: "indie-filmmakers",
        description: "A space for independent filmmakers to share work, find collaborators, and discuss the craft.",
        category: "Film & Video",
      },
    }),
    prisma.community.create({
      data: {
        name: "Design Systems",
        slug: "design-systems",
        description: "Discussion and showcase of design systems, component libraries, and UI/UX patterns.",
        category: "Art & Design",
      },
    }),
    prisma.community.create({
      data: {
        name: "Writers Circle",
        slug: "writers-circle",
        description: "A supportive community for writers of all kinds. Share your work, get feedback, find your voice.",
        category: "Writing",
      },
    }),
  ]);

  const [creativeCoder, soundVision, indieFilm, designSystems, writersCircle] = communities;

  // Add community members
  const membershipData = [
    { userId: alex.id, communityId: creativeCoder.id, role: "admin" },
    { userId: jordan.id, communityId: creativeCoder.id, role: "moderator" },
    { userId: riley.id, communityId: creativeCoder.id },
    { userId: kai.id, communityId: creativeCoder.id },
    { userId: demo.id, communityId: creativeCoder.id },
    { userId: maya.id, communityId: soundVision.id, role: "admin" },
    { userId: alex.id, communityId: soundVision.id },
    { userId: sam.id, communityId: soundVision.id },
    { userId: kai.id, communityId: soundVision.id },
    { userId: sam.id, communityId: indieFilm.id, role: "admin" },
    { userId: maya.id, communityId: indieFilm.id },
    { userId: nova.id, communityId: indieFilm.id },
    { userId: riley.id, communityId: designSystems.id, role: "admin" },
    { userId: alex.id, communityId: designSystems.id },
    { userId: jordan.id, communityId: designSystems.id },
    { userId: luna.id, communityId: writersCircle.id, role: "admin" },
    { userId: nova.id, communityId: writersCircle.id },
    { userId: ash.id, communityId: writersCircle.id },
  ];

  await prisma.communityMember.createMany({
    data: membershipData.map(({ userId, communityId, role }) => ({
      userId,
      communityId,
      role: role || "member",
    })),
  });

  console.log(`Created ${communities.length} communities`);

  // Create posts
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        content: "Just shipped a new generative art piece using WebGL and custom shaders. The intersection of code and creativity never gets old. What tools are you all using for creative coding?",
        authorId: alex.id,
        communityId: creativeCoder.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Been experimenting with granular synthesis and field recordings from Shibuya. There's something magical about turning city sounds into music.",
        authorId: maya.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Hot take: the best code is the code you delete. Just refactored 3,000 lines down to 800. Feels incredible.",
        authorId: jordan.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "New poem:\n\nWe are the spaces between signals,\nthe silence that makes music possible,\nthe pause before connection becomes real.\n\nMesh me into your story.",
        authorId: luna.id,
        communityId: writersCircle.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Wrapped principal photography on our short film today. Six months of planning, three days of shooting, infinite gratitude for the team. Can't wait to share it.",
        authorId: sam.id,
        communityId: indieFilm.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Design systems aren't about consistency for consistency's sake. They're about creating a shared language that lets your team move faster while maintaining quality.",
        authorId: riley.id,
        communityId: designSystems.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Starting a new game jam project this weekend! Theme is 'connections'. Going to build something about invisible threads between people. Who's in?",
        authorId: kai.id,
        communityId: creativeCoder.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Golden hour in Brooklyn never disappoints. Shot this on my phone walking home from the studio. Sometimes the best camera is the one you have with you.",
        authorId: nova.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Made a fusion dish today: Mumbai street food meets French technique. Masala dosa with beurre blanc and micro herbs. Food is the original creative medium.",
        authorId: ash.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "The future of social media isn't about more content. It's about more meaningful connections. That's why I'm excited about what mesh.me is building.",
        authorId: alex.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Just discovered that three people I follow here are all into the same obscure ambient music I love. This is what good discovery feels like.",
        authorId: maya.id,
        communityId: soundVision.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Working on a new component library with zero dependencies. Every component is accessible, themeable, and under 2KB. Open source coming soon.",
        authorId: jordan.id,
        communityId: designSystems.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Writing prompt for the community: Describe a color without naming it or using visual metaphors. Use only textures, sounds, and emotions.",
        authorId: luna.id,
        communityId: writersCircle.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "Protip for indie filmmakers: invest in good sound design before fancy cameras. Audiences will forgive rough visuals but not bad audio.",
        authorId: sam.id,
        communityId: indieFilm.id,
      },
    }),
    prisma.post.create({
      data: {
        content: "love how mesh.me actually surfaces people based on shared interests instead of just follower count. found 5 amazing artists today i never would have discovered on other platforms.",
        authorId: demo.id,
      },
    }),
  ]);

  console.log(`Created ${posts.length} posts`);

  // Add tags to posts
  await prisma.postTag.createMany({
    data: [
      { postId: posts[0].id, tag: "creative-coding" },
      { postId: posts[0].id, tag: "webgl" },
      { postId: posts[1].id, tag: "music-production" },
      { postId: posts[1].id, tag: "field-recording" },
      { postId: posts[2].id, tag: "clean-code" },
      { postId: posts[3].id, tag: "poetry" },
      { postId: posts[4].id, tag: "filmmaking" },
      { postId: posts[5].id, tag: "design-systems" },
      { postId: posts[6].id, tag: "game-jam" },
      { postId: posts[7].id, tag: "photography" },
      { postId: posts[8].id, tag: "fusion-cooking" },
    ],
  });

  // Create reactions
  const reactionPairs = [
    [maya.id, posts[0].id], [jordan.id, posts[0].id], [riley.id, posts[0].id],
    [alex.id, posts[1].id], [sam.id, posts[1].id], [kai.id, posts[1].id],
    [alex.id, posts[2].id], [riley.id, posts[2].id],
    [alex.id, posts[3].id], [maya.id, posts[3].id], [nova.id, posts[3].id],
    [maya.id, posts[4].id], [nova.id, posts[4].id], [alex.id, posts[4].id],
    [alex.id, posts[5].id], [jordan.id, posts[5].id],
    [jordan.id, posts[6].id], [maya.id, posts[6].id],
    [alex.id, posts[7].id], [sam.id, posts[7].id], [ash.id, posts[7].id],
    [nova.id, posts[8].id], [maya.id, posts[8].id],
    [maya.id, posts[9].id], [jordan.id, posts[9].id], [luna.id, posts[9].id], [riley.id, posts[9].id],
    [alex.id, posts[10].id], [kai.id, posts[10].id],
    [alex.id, posts[11].id], [riley.id, posts[11].id],
    [maya.id, posts[12].id], [nova.id, posts[12].id],
    [alex.id, posts[13].id], [nova.id, posts[13].id],
    [alex.id, posts[14].id], [maya.id, posts[14].id], [jordan.id, posts[14].id],
  ];

  await prisma.reaction.createMany({
    data: reactionPairs.map(([userId, postId]) => ({ userId, postId, type: "like" })),
  });

  console.log(`Created ${reactionPairs.length} reactions`);

  // Create comments
  const comments = await Promise.all([
    prisma.comment.create({
      data: {
        content: "This is incredible! Would love to see the shader code. Are you using GLSL or something higher-level?",
        authorId: jordan.id,
        postId: posts[0].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: "The colors in this are stunning. Reminds me of Refik Anadol's work but with your own unique touch.",
        authorId: riley.id,
        postId: posts[0].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: "This poem hit different. The 'mesh me into your story' line is beautiful.",
        authorId: alex.id,
        postId: posts[3].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: "Can't wait to see the final cut! The behind-the-scenes photos looked amazing.",
        authorId: maya.id,
        postId: posts[4].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: "100% agree on the sound design point. Changed my whole approach to filmmaking.",
        authorId: nova.id,
        postId: posts[13].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: "I'm in for the game jam! Let's build something beautiful.",
        authorId: jordan.id,
        postId: posts[6].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: "That fusion sounds incredible. Recipe please!",
        authorId: alex.id,
        postId: posts[8].id,
      },
    }),
  ]);

  // Add a reply
  await prisma.comment.create({
    data: {
      content: "Pure GLSL! I'll put together a breakdown post this week.",
      authorId: alex.id,
      postId: posts[0].id,
      parentId: comments[0].id,
    },
  });

  console.log(`Created ${comments.length + 1} comments`);

  // Create a message thread
  const thread = await prisma.messageThread.create({
    data: {
      members: {
        create: [
          { userId: alex.id },
          { userId: maya.id },
        ],
      },
    },
  });

  await prisma.message.createMany({
    data: [
      { content: "Hey Maya! Loved your latest track. Would you be interested in collaborating on a visual piece?", senderId: alex.id, threadId: thread.id },
      { content: "Alex! I was literally about to message you about that. I have this ambient piece that would be perfect for your generative visuals.", senderId: maya.id, threadId: thread.id },
      { content: "That sounds amazing. Let's set up a call this week to brainstorm.", senderId: alex.id, threadId: thread.id },
    ],
  });

  const demoThread = await prisma.messageThread.create({
    data: {
      members: {
        create: [
          { userId: demo.id },
          { userId: alex.id },
        ],
      },
    },
  });

  await prisma.message.createMany({
    data: [
      { content: "Welcome to Mesh.me! Your constellation is looking great already.", senderId: alex.id, threadId: demoThread.id },
      { content: "Thanks Alex! Just connected my first few accounts.", senderId: demo.id, threadId: demoThread.id },
      { content: "Nice — once your friends join you'll see their meshes light up too.", senderId: alex.id, threadId: demoThread.id },
    ],
  });

  console.log("Created message threads");

  // Create notifications
  await prisma.notification.createMany({
    data: [
      { type: "follow", recipientId: demo.id, actorId: alex.id, message: "Alex Rivera started following you" },
      { type: "like", recipientId: demo.id, actorId: maya.id, postId: posts[14].id, message: "Maya Chen liked your post" },
      { type: "like", recipientId: demo.id, actorId: jordan.id, postId: posts[14].id, message: "Jordan Park liked your post" },
      { type: "comment", recipientId: alex.id, actorId: jordan.id, postId: posts[0].id, message: "Jordan Park commented on your post" },
      { type: "follow", recipientId: alex.id, actorId: demo.id, message: "Demo User started following you" },
    ],
  });

  console.log("Created notifications");

  // Connected accounts with merged for-you feed items for the demo user
  const demoReddit = await prisma.connectedAccount.create({
    data: {
      userId: demo.id,
      platform: "reddit",
      platformUsername: "demouser",
      isActive: true,
      lastSyncAt: new Date(),
    },
  });
  const demoYoutube = await prisma.connectedAccount.create({
    data: {
      userId: demo.id,
      platform: "youtube",
      platformUsername: "Demo User",
      isActive: true,
      lastSyncAt: new Date(),
    },
  });

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
  await prisma.platformFeedItem.createMany({
    data: [
      {
        connectedAccountId: demoReddit.id,
        platformItemId: "t3_demo1",
        authorName: "space_enthusiast",
        authorUsername: "space_enthusiast",
        authorUrl: "https://www.reddit.com/user/space_enthusiast",
        title: "James Webb captures the clearest image yet of a planet forming around a young star",
        content: "The disk structure is incredibly detailed — you can see the gaps where planets are sweeping up material.",
        url: "https://www.reddit.com/r/space/comments/demo1",
        postType: "post",
        likeCount: 48211,
        commentCount: 1932,
        publishedAt: hoursAgo(3),
        rawMetadata: JSON.stringify({ subreddit: "space" }),
      },
      {
        connectedAccountId: demoReddit.id,
        platformItemId: "t3_demo2",
        authorName: "chef_marco",
        authorUsername: "chef_marco",
        authorUrl: "https://www.reddit.com/user/chef_marco",
        title: "I spent 3 years perfecting my grandmother's focaccia recipe. Here's the result.",
        url: "https://www.reddit.com/r/food/comments/demo2",
        postType: "image",
        likeCount: 12904,
        commentCount: 486,
        publishedAt: hoursAgo(7),
        rawMetadata: JSON.stringify({ subreddit: "food" }),
      },
      {
        connectedAccountId: demoReddit.id,
        platformItemId: "t3_demo3",
        authorName: "dev_diaries",
        authorUsername: "dev_diaries",
        authorUrl: "https://www.reddit.com/user/dev_diaries",
        title: "TIL the first computer bug was an actual moth taped into a logbook in 1947",
        url: "https://www.reddit.com/r/todayilearned/comments/demo3",
        postType: "link",
        likeCount: 30177,
        commentCount: 812,
        publishedAt: hoursAgo(12),
        rawMetadata: JSON.stringify({ subreddit: "todayilearned" }),
      },
      {
        connectedAccountId: demoYoutube.id,
        platformItemId: "yt_demo1",
        authorName: "Veritasium",
        authorUsername: "Veritasium",
        authorUrl: "https://youtube.com/@veritasium",
        title: "The Surprising Physics of Falling Cats",
        content: "How do cats always land on their feet? The answer involves some remarkable rotational mechanics.",
        url: "https://youtube.com/watch?v=demo1",
        postType: "video",
        likeCount: 402118,
        commentCount: 18443,
        publishedAt: hoursAgo(5),
        rawMetadata: JSON.stringify({ channelTitle: "Veritasium" }),
      },
      {
        connectedAccountId: demoYoutube.id,
        platformItemId: "yt_demo2",
        authorName: "Marques Brownlee",
        authorUsername: "MKBHD",
        authorUrl: "https://youtube.com/@mkbhd",
        title: "The Fastest Phone of the Year — Full Review",
        url: "https://youtube.com/watch?v=demo2",
        postType: "video",
        likeCount: 289054,
        commentCount: 9210,
        publishedAt: hoursAgo(9),
        rawMetadata: JSON.stringify({ channelTitle: "Marques Brownlee" }),
      },
    ],
  });

  console.log("Created connected accounts and merged feed items");
  console.log("\nSeeding complete!");
  console.log("\nDemo accounts (password: password123):");
  console.log("  Admin: alex@mesh.me / alexcreates");
  console.log("  User:  demo@mesh.me / demouser");
  console.log("  User:  maya@mesh.me / mayamusic");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
