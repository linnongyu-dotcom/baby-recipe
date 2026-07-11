Page({
  data: {
    // 部署后把这里改成你的网站地址
    webUrl: 'https://bakuaiqian.xyz',
  },
  onLoad: function () {
    console.log('宝宝食谱小程序启动');
  },
  onMessage: function (e) {
    // 可以接收网页传来的消息
    console.log('收到网页消息:', e.detail);
  },
  onError: function (e) {
    console.error('web-view 加载错误:', e.detail);
  },
});