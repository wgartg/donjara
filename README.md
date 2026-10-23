# みんなのドンジャラ

部屋コードで集まって、2〜4人で遊べるオンライン対戦ドンジャラ。人数が足りなければCPUも入れられる。
ブラウザだけで動く。対戦のデータは Firebase(Firestore)に置く。

## 遊び方

1. 名前を入れて「部屋を作る」
2. 「招待リンクを送る」で友達にリンクを送る(開くだけで部屋コードが入る)
3. メンバーがそろったら、ホストが「対局開始」

ルールはゲーム画面の「あそびかた」に全部のってる。CPUはホストの画面で動くので、対局中はホストもページを開いたままにしておく(ホストがいなくなると、ほかの人の画面が代わりに動かす)。

## 公開のしかた(最初の1回だけ)

### 1. Firebase

1. [Firebase コンソール](https://console.firebase.google.com/)で新しいプロジェクトを作る
2. **Firestore Database** を作成する(ロケーションは `asia-northeast1` がおすすめ)
3. Firestore の「ルール」タブに [`firestore.rules`](firestore.rules) の中身を貼って「公開」
4. **Authentication** → ログイン方法 → **匿名** を有効にする
5. プロジェクトの設定 → マイアプリ → ウェブアプリを追加して、出てきた `firebaseConfig` の値を [`firebase-config.js`](firebase-config.js) に貼る

### 2. GitHub Pages

1. このリポジトリの Settings → Pages
2. Source を「Deploy from a branch」、Branch を `main` / `(root)` にして Save
3. 少し待つと `https://<ユーザー名>.github.io/<リポジトリ名>/` で遊べる

### 古い部屋を自動で消す(なくてもいい)

Firestore → TTL → ポリシーを作成 → コレクション グループ `rooms`、タイムスタンプのフィールド `expireAt`。
最後の手から2日たった部屋が自動で消える。

## ファイル

| ファイル | 中身 |
|---|---|
| `index.html` | ゲーム本体(画面・ルール・CPU) |
| `firebase-backend.js` | Firestore と匿名ログインへのつなぎ |
| `firebase-config.js` | Firebase の設定(自分の値を貼る) |
| `firestore.rules` | Firestore のセキュリティルール |

## メモ

- `firebase-config.js` の値は、サイトに公開される前提のもの。データの守りは `firestore.rules` でかけている(部屋を作れるのは本人、書き換えられるのは参加者、消せるのはホストだけ)
- 手牌も部屋のデータに入っているので、開発者ツールを使えばほかの人の手牌がのぞける。身内で遊ぶ前提
- Firebase の無料プラン(Spark)で十分遊べる
- `index.html` は claude.ai のアーティファクトとしてもそのまま動く(そのときは claude.ai の保存先を使う)
