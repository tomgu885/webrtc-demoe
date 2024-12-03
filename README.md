
## turn server

```bash
$sudo apt install coturn
$turnserver --help
$turnserver --vesion # 4.6.1
$turnserver  --external-ip 103.192.178.121 --log-file stdout
```


## 名称解释

1. webrtc = real time chat base on web (基于浏览器的试试通讯)
2. ICE = Interactive Connectivity Establishment, 相互连接
2. stun: Session Traversal Utilities for NAT (协商 网络)
3. NAT: ipv4 地址有限，通过地址端口映射
3. turn: 
4. SDP: session description protocol, 多媒体描述协议，包含解码/编码器，分辨率，加密算法 等，双方协商出共同支持的
5. RTP: Real-time Transport Protocol (RFC 3550)
6. Signaling service, 初始化连接时候需要的


## 搭建 coturn 服务器

```bash
$sudo apt update && sudo apt install coturn -y

```

```config
## /etc/turnserver.conf
min-port=49152
max-port=65535
listening-ip=103.192.178.121
relay-ip=103.192.178.121
external-ip=103.192.178.121
user=coturn:Pass@123
realm=turn.dk-chat.com
fingerprint
lt-cred-mech
no-cli
```


## 参考

1. https://medium.com/av-transcode/what-is-webrtc-and-how-to-setup-stun-turn-server-for-webrtc-communication-63314728b9d0
1. https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols
1. https://github.com/robertbunch/webrtc-starter
2. https://www.videosdk.live/developer-hub/stun-turn-server/webrtc-turn-server
3. https://github.com/webrtc/samples