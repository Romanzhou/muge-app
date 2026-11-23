# 沐GE · 吃啥吃啥随机一下！

极简暖白无印风（方案 B）个人食谱与做菜步骤 App，内置 **100 道精选食谱**（深度覆盖岳阳/洞庭湖区与湘菜特色），支持 **火锅 / 小炒 / 素菜 / 煲汤** 分类、人数与口味随机配餐、自动汇总备菜清单、5 级科学做菜先后排序、精细/精简双模式步骤及倒计时。

## 如何生成苹果手机 IPA 安装包（无需买 Mac）

由于苹果官方限制，编译原生 `.ipa` 必须使用 **macOS + Xcode**，Windows 电脑无法在本地直接编译出真实可用的 `.ipa`。本项目已为你内置好 **GitHub Actions 云端 macOS 自动打包脚本**：

1. 在 [GitHub](https://github.com/new) 新建一个仓库（可设为 Private 私有）。
2. 将本文件夹 (`muge-app`) 里的所有文件上传到该仓库（保留 `.github/workflows/build-ios-ipa.yml`）。
3. 打开仓库顶部的 **Actions** 页面，等待约 4–6 分钟，**Build iOS IPA (沐GE)** 自动跑完。
4. 在底部 **Artifacts** 下载 **`MuGE-iOS-IPA`**，解压即可得到真正的 **`MuGE-unsigned.ipa`**（同时还会自动生成安卓安装包 **`MuGE-Android-APK`**）。
5. 安装到 iPhone：
   - **免越狱个人自签**：Windows 上用 **Sideloadly** 或 **爱思助手**（工具箱 -> IPA 签名），登录你的 Apple ID 自签后一键装到 iPhone（每 7 天免费续签一次，或使用个人/开发者证书 1 年有效）。
   - **巨魔商店（TrollStore）**：支持设备可直接免签名永久安装 `MuGE-unsigned.ipa`。

## 现在立刻在苹果手机上试用（带你的图标和「沐GE」桌面名）

1. 在本目录终端运行：`node serve.js`
2. 苹果手机连同一个 Wi-Fi，用 **Safari** 打开终端打印的局域网地址（如 `http://192.168.x.x:8080`）。
3. 点 Safari 底部 **分享** → **添加到主屏幕**，桌面就会出现你上传的图标和 **「沐GE」**，支持全屏无地址栏、离线使用！
