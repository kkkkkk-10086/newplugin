import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import { segment } from 'oicq'
import fs from "fs";
import uploadRecord from '../xiaofei-plugin/model/uploadRecord.js';//小飞插件模块https://gitee.com/xfdown/xiaofei-plugin.git
const _path = process.cwd();
//如果是本地部署爬虫，要把所有的“api.douyin.wtf”改成“127.0.0.1:8000”。本地部署请到https://github.com/Evil0ctal/Douyin_TikTok_Download_API查看readme.md
//在线调用实测非常容易寄，建议本地部署，需要python环境
//必须！到https://api.tikhub.io/注册账号（首页Authorization板块->Register User），注册成功后账号密码填下面
const username = "" //账号
const password = "" //密码
//作者2066855608
/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class example extends plugin {
  constructor () {
    super({
      name: '视频功能',
      dsc: '视频',
      /* oicq文档：https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^((.*)复制打开抖音(.*)|(.*)v.douyin.com(.*))$',
          fnc: 'douy'
        },
        {
          reg: '^((.*)tiktok.com(.*))$',
          fnc: 'Tiktok'
        },
        {
          reg: '^((.*)快手(.*)快手(.*)|(.*)v.kuaishou(.*))$',
          fnc: 'kuaiscz'
        },
]})}

/**
 * 
 * @param {*} qq 
 * @param {*} title xml标题
 * @param {*} msg 发送的内容
 * @returns 
 */
async  makeForwardMsg (qq, title, msg = []) {
  let nickname = Bot.nickname
  if (this.e.isGroup) {
    let info = await Bot.getGroupMemberInfo(this.e.group_id, qq)
    nickname = info.card ?? info.nickname
  }
  let userInfo = {
    user_id: this.e.user_id,
    nickname: this.e.sender.card || this.e.user_id,
  }

  let forwardMsg = []
  msg.forEach(v => {
    forwardMsg.push({
      ...userInfo,
      message: v
    })
  })

  /** 制作转发内容 */
  if (this.e.isGroup) {
    forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
  } else {
    forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
  }

  /** 处理描述 */
  forwardMsg.data = forwardMsg.data
    .replace(/\n/g, '')
    .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
    .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)

  return forwardMsg
}


//抖音----------------------------------------------------------------------------------
async douy(e){
  //请求接口获取账号token
  let headers = {
    "accept": "application/json",
    "Content-type": "application/x-www-form-urlencoded",
  }
  let body = `grant_type=&username=${username}&password=${password}&scope=&client_id=&client_secret=`
  let vdata = await fetch(`https://api.tikhub.io/user/login?token_expiry_minutes=2&keep_login=true`,{
  method: "POST",
  headers,
  body
})
//返回数据转json
let tokendata = await vdata.json();
let access_token = tokendata.access_token

//提取链接
  let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
  let URL = e.toString().match(regexp);
  //处理请求头
  let headers2 = {
    "accept": "application/json",
    "Authorization": `Bearer ${access_token}`,
  }
  //请求签到接口获取请求次数(每账号每日可领50-100次请求次数)
  await fetch(`https://api.tikhub.io/promotion/daily_check_in`, {
    method: "GET",
    headers: headers2
  })
  //请求接口2(评论数据)
  let comments_data = await fetch(`https://api.tikhub.io/douyin_video_comments/?douyin_video_url=${URL}cursor=0&count=20`,{
    method: "GET",
    headers: headers2
  })
  //请求接口3，完整视频数据(本地部署有什么意义啊(bushi
  //没开源
  let statistics = await fetch (`https://api.tikhub.io/douyin_video_data/?douyin_video_url=${URL}`, {
    method: "GET",
    headers: headers2
  })
  //返回单个视频完整数据转json
  let sharedata = await statistics.json();
  //返回评论数据转json
  let comments = await comments_data.json();
  let nrymsg = await fetch(`http://127.0.0.1:8000/api?url=${URL}&minimal=false`,{
    method: "GET"
  });
  let data1 = await nrymsg.json();
  if(data1.message === "获取视频ID失败！/Failed to get video ID!") {
    e.reply(data1.message)
    return
  }
  let data;
  const starttime = new Date();
  while(true) { 
  let nrymsg = await fetch(`http://127.0.0.1:8000/api?url=${URL}&minimal=false`,{
    method: "GET"
  });
  console.log(`请求链接：https://api.douyin.wtf/api?url=${URL}&minimal=false`)
  data = await nrymsg.json();
  if(data.status === "failed") {
  } else if(data.status ==="success") {
    break
  }
  const endtime = new Date();
  const duration = (endtime - starttime) / 1000; //计算执行之间，单位秒
  if(duration>=30) {
    e.reply("你请求的视频是不是被隐藏或者下架了？")
    return
  }
}
  //等两秒
  await sleep (2000)
  if (data.video_data === undefined) {
    let res = []
    let image = data.image_data.no_watermark_image_list
    if(data.image_data.no_watermark_image_list === undefined) {
      e.reply("请求错误，请再试一次...")
      return
    }
    //定位标题
    let bt = data.desc
    //作者头像
    let tx = data.author.avatar_thumb.url_list[0]
    //作者名称
    let name = data.author.nickname
    //BGM名字
    let BGMname = data.music.title
    //视频点赞、评论、分享、收藏
    let dz = sharedata.aweme_list[0].statistics.digg_count
    if(dz > 10000) {
      dz = (dz / 10000).toFixed(1) + "万"
    }
    let pl = sharedata.aweme_list[0].statistics.comment_count
    if(pl > 10000) {
      pl = (pl / 10000).toFixed(1) + "万"
    }
    let fx = sharedata.aweme_list[0].statistics.share_count
    if(fx > 10000) {
      fx = (fx / 10000).toFixed(1) + "万"
    }
    let sc = sharedata.aweme_list[0].statistics.collect_count
    let xmltitle = (`该图集在抖音被点赞了${dz}次，拥有${pl}条评论，被分享了${fx}次`)
    //抖音号
    let dyid;
    if (data.author.unique_id === "") {
      if(data.author.short_id === "") {
        dyid = "找不到他/她的抖音ID"
      } else {
        dyid = data.author.short_id;
      }   
    } else {
      dyid = data.author.unique_id;
    }
    //BGM直链
    let music = data.music.play_url.uri
    let cause = data.music.offline_desc
    //处理转发信息
    res.push(`图集标题：${bt}`)
    //遍历json数据确定图片数量等待制作转发消息
    for(let i=0; i<image.length; i++) {
      let image_url = image[i]
      res.push(segment.image(image_url))
    }
    res.push(`抖音号：${dyid}【${name}的图文作品】`)
        //处理评论数据
        if (comments) {
          let comments_list = comments.comments_list.slice(0, 15);
          let video_dz = []
          for (let i = 0; i < comments_list.length; i++) {
            let text = comments_list[i].text;
            let ip = comments_list[i].ip_label;
            let digg_count = comments_list[i].digg_count;
            if(digg_count > 10000) {
              digg_count = (digg_count / 10000).toFixed(1) + "w"
            }
            video_dz.push(`${i + 1}. ${text} \nip：${ip}            ♥${digg_count}`);
          }
          let dz_text = video_dz.join("\n\n")
          res.push(`🔥热门评论🔥\n${dz_text}`)
        } else {
          res.push("评论数据获取失败")
        }
    
    res.push(`BGM：${BGMname}\nBGM地址：${music}${cause}`)
    console.log(res)
    //制作合并转发消息
    let msg = await this.makeForwardMsg(e.user_id, xmltitle, res)
    await this.e.reply(msg)
    //如果音频直链为空
    if (!data.music.play_url.uri) {
      let cause = data.music.offline_desc
      e.reply(`无法上传，原因：${cause}`, false)
      return 
    } else {
      //发送高清语音
      let music = data.music.play_url.uri
      console.log(music)
      e.reply(await uploadRecord(music, 0, false))
    }
  } 
  //获取视频数据
  else {
    let qiy = {
      "Server": "CWAP-waf",
      "Content-Type": "video/mp4",
    }
    let mp4= await fetch(`${data.video_data.nwm_video_url_HQ}`,{method: "get",headers:qiy});
    let res2 = []
    let basic = "Successfully processed, please wait for video upload"
    //标题
    let bt = data.desc
    //抖音头像
    let tx = data.author.avatar_thumb.url_list[0]
    console.log(tx)
    //作者名称
    let name = data.author.nickname
    //BGM名字
    let BGMname = data.music.title
    //抖音号
    //let dyid = data.author.unique_id
    let dyid;
    if (data.author.unique_id === "") {
      if(data.author.short_id === "") {
        dyid = "找不到他/她的抖音ID"
      } else {
        dyid = data.author.short_id;
      }   
    } else {
      dyid = data.author.unique_id;
    }
        //视频点赞、评论、分享、收藏
        let dz = sharedata.aweme_list[0].statistics.digg_count
        if(dz > 10000) {
          dz = (dz / 10000).toFixed(1) + "万"
        }
        let pl = sharedata.aweme_list[0].statistics.comment_count
        if(pl > 10000) {
          pl = (pl / 10000).toFixed(1) + "万"
        }
        let fx = sharedata.aweme_list[0].statistics.share_count
        if(fx > 10000) {
          fx = (fx / 10000).toFixed(1) + "万"
        }
        let sc = sharedata.aweme_list[0].statistics.collect_count
        let xmltitle = (`该视频在抖音被点赞了${dz}次，拥有${pl}条评论，被分享了${fx}次`)
    //BGM地址
    let music = data.music.play_url.uri
    let cause = data.music.offline_desc
    //视频封面
    let cover = data.cover_data.dynamic_cover.url_list[0]
    //视频直链
    let video = data.video_data.nwm_video_url_HQ
    //处理基本信息
    res2.push(basic)
    res2.push(`抖音号：${dyid}【${name}的视频作品】`)
    res2.push(`视频标题：${bt}`)
    res2.push(`要是等不及视频上传，可以先看看这个 👇${video}`)
    //处理评论数据
    if (comments) {
      let comments_list = comments.comments_list.slice(0, 15);
      let video_dz = []
      for (let i = 0; i < comments_list.length; i++) {
        let text = comments_list[i].text;
        let ip = comments_list[i].ip_label;
        let digg_count = comments_list[i].digg_count;
        if(digg_count > 10000) {
          digg_count = (digg_count / 10000).toFixed(1) + "w"
        }
          video_dz.push(`${i + 1}. ${text} \nip：${ip}            ♥${digg_count}`);
      }
      let dz_text = video_dz.join("\n\n")
      res2.push(`🔥热门评论🔥\n${dz_text}`)
    } else {
      res2.push("评论数据获取失败")
    }
    res2.push(`BGM：${BGMname}\nBGM地址：${music}${cause}`)
    res2.push(`视频封面：${cover}`)
    console.log(res2)
    let video_data = await this.makeForwardMsg(e.user_id, xmltitle, res2)
    await this.e.reply(video_data)
    console.log("视频直链：", video)
    let a = await mp4.buffer();
    let path =`${_path}/plugins/example/douyin.mp4`;
    fs.writeFile(path,a,"binary",function (err) {
      if (!err) {
        e.reply([segment.video(path)]);
        console.log("视频下载成功");}
        return false})
        if(!e.reply) {
          return("解析API报错，等待恢复...")
        }
      }
    }



//tiktok------------------------------------------------------------------------------------------
async Tiktok(e){
  //JS 正则匹配 URL
  let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
  let mr = e.msg.replace("Tiktok", "").trim();
  let nrymsg= await fetch(`https://api.douyin.wtf/api?url=${mr}`,{
  method: "GET"});
  let data = await nrymsg.json();
  let qiy = {
  "Server": "CWAP-waf",
  "Content-Type": "video/mp4",
  }
  
  let mp4= await fetch(`${data.video_data.nwm_video_url_HQ}`,{method: "get",headers:qiy});
  e.reply([`发现Tik Tok分享...\n正在读取 URL...`]);
  let lopp = await mp4.buffer();
  let path =`${_path}/plugins/example/Tiktok.mp4`;
  fs.writeFile(path,lopp,"binary",function (err) {
    if (!err) {
  // 下载视频成功
  e.reply([segment.video(path)]);
  console.log("视频下载成功");} 
  return true
  })}
  
  //--------快手-------------------------------------------------------------------------------------------------
async kuaiscz(e){

  //JS 正则匹配 URL
  let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
  let mr = e.toString().match(regexp);
  
  
  e.reply([`发现快手分享...\n正在读取 URL...`]);
  
  let msg= await fetch(`${mr}`,{
  method: "get",
  });
  
  let url = await msg.url;
  // console.log(url)
  //获取跳转url
  
  let fid=""
  url.replace(/fid=(.*)&cc/g,function (a1){
  fid=a1.replace('fid=','').replace('&cc','')
  return ""
  })
  // console.log(fid)
  //视频id
  
  let shareToken=""
  url.replace(/shareToken=(.*)&shareResourceType/g,function (a1){
  shareToken=a1.replace('shareToken=','').replace('&shareResourceType','')
  return ""
  })
  // console.log(shareToken)

  let shareObjectId=""
  url.replace(/shareObjectId=(.*)&shareUrlOpened/g,function (a1){
  shareObjectId=a1.replace('shareObjectId=','').replace('&shareUrlOpened','')
  return ""
  })
  
  let shareId=""
  url.replace(/shareId=(.*)&shareToken/g,function (a1){
  shareId=a1.replace('shareId=','').replace('&shareToken','')
  return ""
  })
  
  
  let photoId=""
  url.replace(/photoId=(.*)&shareId/g,function (a1){
  photoId=a1.replace('photoId=','').replace('&shareId','')
  return ""
  })
  
  
  let mouy={
    "operationName": "visionVideoDetail",
    "variables": {
      "photoId": `${photoId}`,
      "page": "detail"
    },
    "query": "query visionVideoDetail($photoId: String, $type: String, $page: String, $webPageArea: String) {\n  visionVideoDetail(photoId: $photoId, type: $type, page: $page, webPageArea: $webPageArea) {\n    status\n    type\n    author {\n      id\n      name\n      following\n      headerUrl\n      __typename\n    }\n    photo {\n      id\n      duration\n      caption\n      likeCount\n      realLikeCount\n      coverUrl\n      photoUrl\n      liked\n      timestamp\n      expTag\n      llsid\n      viewCount\n      videoRatio\n      stereoType\n      musicBlocked\n      manifest {\n        mediaType\n        businessType\n        version\n        adaptationSet {\n          id\n          duration\n          representation {\n            id\n            defaultSelect\n            backupUrl\n            codecs\n            url\n            height\n            width\n            avgBitrate\n            maxBitrate\n            m3u8Slice\n            qualityType\n            qualityLabel\n            frameRate\n            featureP2sp\n            hidden\n            disableAdaptive\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      manifestH265\n      photoH265Url\n      coronaCropManifest\n      coronaCropManifestH265\n      croppedPhotoH265Url\n      croppedPhotoUrl\n      videoResource\n      __typename\n    }\n    tags {\n      type\n      name\n      __typename\n    }\n    commentLimit {\n      canAddComment\n      __typename\n    }\n    llsid\n    danmakuSwitch\n    __typename\n  }\n}\n"
  }
  // console.log(mouy)
  
  let monr=JSON.stringify(mouy).trim()
  // console.log(monr)
  //合成请求
  
  let headers = {
      "Host": "www.kuaishou.com",
      "Connection": "keep-alive",
      "Content-Length": "1665",
      "accept": "*/*",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
      "content-type": "application/json",
      "Origin": "https://www.kuaishou.com",
      "X-Requested-With": "mixiaba.com.Browser",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://www.kuaishou.com/short-video/3xpuqz8q3iuf6y4?userId=3xxkinh99kp5sy6",
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": "zh-CN,zh;q=0.9,te-CN;q=0.8,te;q=0.7,ug-CN;q=0.6,ug;q=0.5,en-US;q=0.4,en;q=0.3",
      "Cookie": "did=web_6658c6827a7d4b888304ec450b7ec1ca; didv=1667743407000; Hm_lvt_86a27b7db2c5c0ae37fee4a8a35033ee=1667743490; Hm_lpvt_86a27b7db2c5c0ae37fee4a8a35033ee=1667743490; kpf=PC_WEB; kpn=KUAISHOU_VISION; clientid=3; userId=2825489699; kuaishou.server.web_st=ChZrdWFpc2hvdS5zZXJ2ZXIud2ViLnN0EqABs0fkXqv43kjQMJk_TsNsEfo-FDVSR0D3CsV30AbBcXLUNWQw4I0n3K9wupx2pnDPLgXP7wVfFKrHljrUV_YWGz0JXJr97e1OsRUHVG0yoQoBcTHNSiRRMk9i8rAt2A6VS2vfA-Q4pHhMkdKtcuxG4wHmjAIiC7P7BDw4V9Wlzb9VJOaijgJqC1mmVZ1njaBv6rHR73HJMiDAEufnIwWAwhoSsguEA2pmac6i3oLJsA9rNwKEIiAH4WfZ82GKoxWnDNBJuFsqpehjIiSR_2IcP-BA9JyR3ygFMAE; kuaishou.server.web_ph=2779c2a8f91c9b71cd53694771d45961cc25"
  }
  
  
  //请求头
  let response = await fetch(`https://www.kuaishou.com/graphql`, {
  method: "POST",
  headers,
  body: `${monr}`
  });
  // console.log(response)
  
  
  let dat = await response.json();
  console.log(dat)
  
  
  if (dat.data.visionVideoDetail.status==1 ){
  
  let zuoz=dat.data.visionVideoDetail.author.name
  //作者名称
  
  let shipmx=dat.data.visionVideoDetail.photo.caption
  //视频描述
  
  
  let xhx=dat.data.visionVideoDetail.photo.likeCount
  //视频❤️
  let zugz=dat.data.visionVideoDetail.photo.duration
  //视频评论
  let zusoc=dat.data.visionVideoDetail.photo.realLikeCount
  //此视频收藏人数
  let zusbfl=dat.data.visionVideoDetail.photo.viewCount
  //此视频播放量
  
  let ship=dat.data.visionVideoDetail.photo.coverUrl
  //视频封面
  let shipdz=dat.data.visionVideoDetail.photo.photoUrl
  //视频地址
  
  /*
  let shipys=data.photo.soundTrack.audioUrls[0].url
  //视频原声
  let miuily=data.photo.soundTrack.name
  //视频来源
  */
  
  /*e.reply([
  segment.image(`${ship}`),
  `视频作者：${zuoz}\n作品描述：${shipmx}\n\n视频双击：${xhx}\n视频评论：${zugz}\n视频收藏：${zusoc}\n此视频播放量：${zusbfl}\n\n正在转化视频～请等待......`
  ]);*/
  
  let qiy = {
  "Server": "CWAP-waf",
  "Content-Type": "video/mp4",
  }
  
  
  let mp4= await fetch(`${shipdz}`,{method: "get",headers:qiy});
  
  let lopp = await mp4.buffer();
  let path =`${_path}/plugins/example/快手.mp4`;
  fs.writeFile(path,lopp,"binary",function (err) {
  console.log(err || "下载视频成功");
    if (!err) {
     e.reply([segment.video(path)]);
    }});
  } else {
  e.reply([`获取失败了！可能不是视频！`])
  }
  return true
  }
  
}