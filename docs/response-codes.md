# Response Code Map

> 由 `scripts/generateResponseCodeDoc.ts` 自动生成，请勿手工修改。

## 号段规则

- 成功码：2xx
- 业务错误码：4xx
- 系统错误码：5xx

## 成功码

| code | httpStatus | message |
| --- | --- | --- |
| 200 | 200 | success |
| 201 | 201 | created |

## 业务错误码

| code | httpStatus | message |
| --- | --- | --- |
| 400 | 400 | bad request |
| 401 | 401 | unauthorized |
| 403 | 403 | forbidden |
| 404 | 404 | not found |
| 409 | 409 | conflict |
| 422 | 422 | unprocessable entity |

## 系统错误码

| code | httpStatus | message |
| --- | --- | --- |
| 500 | 500 | internal server error |
