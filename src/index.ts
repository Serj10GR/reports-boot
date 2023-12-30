const express = require('express');
const cors = require('cors');
const cron = require('cron');

const User = require('./models');

const findUser = async (username: string) => User.findOne({ username });

require('dotenv').config();

let TelegramBot = require('node-telegram-bot-api');

const app = express();

let bot = new TelegramBot(process.env.TOKEN, { polling: true });

app.use(cors());
app.use(express.json());

// Define states for the conversation
const STATES = {
  IDLE: 'idle',
  START: 'start',
  CHOOSE_PROFILE: 'choose_profile',
  PARTICIPATED: 'participated',
  HOURS: 'hours',
  STUDIES: 'studies',
  FINISH: 'finsh',
};

// Handle the /start command to capture user chatId and username
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name;

  const user = await findUser(username);

  console.log('conversation start, user is', user);

  // if user is presend reset chat id and state
  if (user) {
    await User.findByIdAndUpdate(user.id, { state: STATES.IDLE, chatId });
  }

  if (!user) {
    const newUser = new User({
      firstName,
      lastName,
      chatId,
      username,
      state: STATES.IDLE,
    });

    await newUser.save();
  }

  bot.sendMessage(
    chatId,
    `Salut, *${firstName}*!
Eu te voi ajuta să trimiți raportul de activitate.
Îți voi trimite un mesaj în fiecare început de lună pentru a colecta raportul.
Ori poți trimite raportul în orice moment folosind comanda /raport`,
    { parse_mode: 'Markdown' },
  );
});

// Handle incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const username = msg.from.username;

  if (messageText === '/start') return;

  // Find or create user in the database
  let user = await findUser(username);
  if (!user) {
    console.log(`username ${username} was not found in db`);
    bot.sendMessage(
      chatId,
      'ups :( avem probleme ⚠️ se pare că Sergiu a șters profilul tău din baza de date. Trebuie să stergi chatul și să incepi din nou folosind butonul "Start"',
    );
    return;
  }

  console.log({
    messageText,
    username,
    state: user.state,
  });

  // Handle incoming messages based on the user's state
  switch (user.state) {
    case STATES.START:
      await User.findByIdAndUpdate(user.id, { state: STATES.CHOOSE_PROFILE });
      // Start the conversation
      bot.sendMessage(
        chatId,
        'Pentru inceput te rog să alegi profilul (vestitor sau pionier)',
        {
          reply_markup: {
            keyboard: [['vestitor', 'pionier']],
            one_time_keyboard: true,
          },
        },
      );
      break;

    case STATES.CHOOSE_PROFILE:
      // Process the chosen profile
      if (messageText.toLowerCase() === 'vestitor') {
        await User.findByIdAndUpdate(user.id, {
          state: STATES.PARTICIPATED,
          profile: 'vestitor',
        });
        bot.sendMessage(chatId, 'Ai participat la predicare ?', {
          reply_markup: {
            keyboard: [['da', 'nu']],
            one_time_keyboard: true,
          },
        });
      } else if (messageText.toLowerCase() === 'pionier') {
        await User.findByIdAndUpdate(user.id, {
          state: STATES.HOURS,
          profile: 'pionier',
        });
        bot.sendMessage(
          chatId,
          'Ai ales profilul "pionier". Câte ore ai făcut?',
        );
      }
      break;

    case STATES.PARTICIPATED:
      if (messageText.toLowerCase() === 'da') {
        await User.findByIdAndUpdate(user.id, {
          state: STATES.STUDIES,
          participated: true,
        });

        bot.sendMessage(chatId, 'Super! Câte studii biblice ai?');
      } else {
        await User.findByIdAndUpdate(user.id, {
          state: STATES.IDLE,
          participated: false,
        });

        bot.sendMessage(chatId, 'Mulțumesc!');
      }
      break;

    case STATES.HOURS:
      const hours = parseInt(messageText);
      if (isNaN(hours)) {
        bot.sendMessage(chatId, 'Este necesar sa introducti un numar');
      }

      await User.findByIdAndUpdate(user.id, { state: STATES.STUDIES, hours });
      bot.sendMessage(chatId, 'Mulțumesc! Cate studii biblice ai?');
      break;

    case STATES.STUDIES:
      const bibleStudies = parseInt(messageText);

      if (isNaN(bibleStudies)) {
        bot.sendMessage(chatId, 'Este necesar sa introducti un numar');
      }

      const updatedUser = await User.findByIdAndUpdate(
        user.id,
        { state: STATES.IDLE, bibleStudies },
        { new: true },
      );
      bot.sendMessage(
        chatId,
        `Raportul a fost trimis cu succes! ✅
        
  *${updatedUser.firstName} ${updatedUser.lastName}*
  *Profil* - ${updatedUser.profile}
  ${
  updatedUser.profile === 'pionier'
    ? `*Ore* - ${updatedUser.hours}`
    : `*A participat la predicare* - ${updatedUser.participated ? 'da' : 'nu'}`
}
  *Studii* - ${updatedUser.bibleStudies}

  Success pentru luna viitoare!`,
        { parse_mode: 'Markdown' },
      );
      break;

    default:
      console.log(`message non handled for status ${user.state} `);
      // Handle other states as needed
      break;
  }
});

bot.onText(/\/raport/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  let user = await findUser(username);

  if (!user) {
    console.log(`username ${username} was not found in db`);
    bot.sendMessage(
      chatId,
      'ups :( avem probleme ⚠️ se pare că Sergiu a șters profilul tău din baza de date. Trebuie să stergi chatul și să incepi din nou folosind butonul "Start"',
    );
    return;
  }

  await User.findByIdAndUpdate(user.id, { state: STATES.CHOOSE_PROFILE });

  bot.sendMessage(
    chatId,
    'Pentru inceput te rog să alegi profilul (vestitor sau pionier)',
    {
      reply_markup: {
        keyboard: [['vestitor', 'pionier']],
        one_time_keyboard: true,
      },
    },
  );
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const job = new cron.CronJob(
  '0 0 * * * *', // cronTime
  async function () {
    console.log('running cron job');
    const users = await User.find();
    users.forEach((user) => {
      bot.sendMessage(
        user.chatId,
        '🛎️ Reminder: Predă raportul folosind comanda /raport',
      );
    });
  }, // onTick
  null, // onComplete
  true, // start
);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`);
  /* eslint-enable no-console */
});
