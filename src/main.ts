/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import * as fs    from 'fs'
import * as path  from 'path'

/* tslint:disable:variable-name */
import { generate } from 'qrcode-terminal'
import { finis }    from 'finis'  // output before crash
import { FileBox }  from 'file-box'

/**
 * Change `import { ... } from '../'`
 * to     `import { ... } from 'wechaty'`
 * when you are runing with Docker or NPM instead of Git Source.
 */
import {
  Wechaty,
  log,
  qrcodeValueToImageUrl,
}                         from 'wechaty'

const BOT_QR_CODE_IMAGE_FILE = path.resolve(
  __dirname,
  '../docs/images/bot-qr-code.png',
)

const bot = Wechaty.instance()

const welcome = `
| __        __        _           _
| \\ \\      / /__  ___| |__   __ _| |_ _   _
|  \\ \\ /\\ / / _ \\/ __| '_ \\ / _\` | __| | | |
|   \\ V  V /  __/ (__| | | | (_| | |_| |_| |
|    \\_/\\_/ \\___|\\___|_| |_|\\__,_|\\__|\\__, |
|                                     |___/
=============== Powered by Wechaty ===============
-------- https://github.com/chatie/wechaty --------
          Version: ${bot.version(true)}
I'm a bot, my superpower is talk in Wechat.
If you send me a 'ding', I will reply you a 'dong'!
__________________________________________________
Hope you like it, and you are very welcome to
upgrade me to more superpowers!
Please wait... I'm trying to login in...
`

console.log(welcome)

bot
.on('logout'	, user => log.info('Bot', `${user.name()} logouted`))
.on('login'	  , user => {
  log.info('Bot', `${user.name()} login`)
  bot.say('Wechaty login').catch(console.error)
})
.on('scan', (qrcode, status, data) => {
  generate(qrcode, { small: true })
  if (data) {
    console.log(data)
  }
  console.log(qrcodeValueToImageUrl(qrcode))
  console.log('^^^ Online QR Code Image URL ^^^ ')
  console.log(`[${status}] ${qrcode} Scan QR Code above url to log in: `)
})
.on('message', async msg => {
  try {
    console.log(msg.toString())

    if (/^(ding|ping|bing|code)$/i.test(msg.text()) /*&& !msg.self()*/) {
      /**
       * 1. reply 'dong'
       */
      log.info('Bot', 'REPLY: dong')
      await msg.say('dong')

      const joinWechaty =  `Join Wechaty Developers' Community\n\n` +
                            `Wechaty is used in many ChatBot projects by hundreds of developers.\n\n` +
                            `If you want to talk with other developers, just scan the following QR Code in WeChat with secret code: wechaty,\n\n` +
                            `you can join our Wechaty Developers' Home at once`
      await msg.say(joinWechaty)

      /**
       * 2. reply qrcode image
       */
      // const fileBox = FileBox.packLocal(BOT_QR_CODE_IMAGE_FILE)
      const fileBox = FileBox.fromStream(
        fs.createReadStream(BOT_QR_CODE_IMAGE_FILE),
        BOT_QR_CODE_IMAGE_FILE,
      )

      log.info('Bot', 'REPLY: %s', fileBox.toString())
      await msg.say(fileBox)

      /**
       * 3. reply 'scan now!'
       */
      await msg.say('Scan now, because other Wechaty developers want to talk with you too!\n\n(secret code: wechaty)')

    }
  } catch (e) {
    log.error('Bot', 'on(message) exception: %s' , e)
    console.error(e)
  }
})

bot.on('error', async e => {
  log.error('Bot', 'error: %s', e)
  if (bot.logonoff()) {
    await bot.say('Wechaty error: ' + e.message).catch(console.error)
  }
  // await bot.stop()
})

let killChrome: NodeJS.SignalsListener

bot.start()
.then(() => {
  const listenerList = process.listeners('SIGINT')
  for (const listener of listenerList) {
    if (listener.name === 'killChrome') {
      process.removeListener('SIGINT', listener)
      killChrome = listener
    }
  }
})
.catch(async e => {
  log.error('Bot', 'start() fail: %s', e)
  await bot.stop()
  process.exit(-1)
})

let quiting = false
finis(async (code, signal) => {
  log.info('Bot', 'finis(%s, %s)', code, signal)

  if (!bot.logonoff()) {
    log.info('Bot', 'finis() bot had been already stopped')
    doExit(code)
  }

  if (quiting) {
    log.warn('Bot', 'finis() already quiting... return and wait...')
    return
  }

  quiting = true
  let done = false
  // let checkNum = 0
  const exitMsg = `Wechaty will exit ${code} because of ${signal} `

  log.info('Bot', 'finis() broadcast quiting message for bot')
  await bot.say(exitMsg)
      // .then(() => bot.stop())
      .catch(e => log.error('Bot', 'finis() catch rejection: %s', e))
      .then(() => done = true)

  setImmediate(checkForExit)

  function checkForExit() {
    // if (checkNum++ % 100 === 0) {
    log.info('Bot', 'finis() checkForExit() checking done: %s', done)
    // }
    if (done) {
      log.info('Bot', 'finis() checkForExit() done!')
      setTimeout(() => doExit(code), 1000)  // delay 1 second
      return
    }
    // death loop to wait for `done`
    // process.nextTick(checkForExit)
    // setImmediate(checkForExit)
    setTimeout(checkForExit, 100)
  }
})

function doExit(code: number): void {
  log.info('Bot', 'doExit(%d)', code)
  if (killChrome) {
    killChrome('SIGINT')
  }
  process.exit(code)
}

// process.on('SIGINT', function() {
//   console.log('Nice SIGINT-handler')
//   const listeners = process.listeners('SIGINT')
//   for (let i = 0; i < listeners.length; i++) {
//       console.log(listeners[i].toString())
//   }
// })
