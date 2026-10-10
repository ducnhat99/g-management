# G-management

Theo dõi lời/lỗ các lần mua nhẫn trơn 9999 theo giá mua vào của Ngọc Thịnh.

| Thư mục           | Nội dung                                             |
| ----------------- | ---------------------------------------------------- |
| `apps/api`        | NestJS API, port 4000                                |
| `apps/web`        | Next.js web, port 3000                               |
| `packages/shared` | Type, schema và hàm tính dùng chung (`@gold/shared`) |

## Yêu cầu

- Node 24 (`nvm use` đọc `.nvmrc`)
- pnpm 10 qua corepack: `corepack enable pnpm`

## Cài đặt

```bash
nvm use
corepack enable pnpm
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Điền giá trị Supabase vào hai file `.env` khi tới Phase 1 (database) và Phase 6 (đăng nhập). Phase 0 chạy được
khi chưa điền.

## Chạy

```bash
pnpm dev
```

- API: http://localhost:4000/health trả `{"status":"ok"}`
- Web: http://localhost:3000

## Lệnh khác

```bash
pnpm build       # build shared, rồi api và web
pnpm test        # Vitest ở cả 3 package
pnpm lint
pnpm typecheck
pnpm format
```
