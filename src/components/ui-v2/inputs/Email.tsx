import * as React from "react"
import { Text, type TextProps } from "./Text"

export type EmailProps = Omit<TextProps, "type">

const Email = React.forwardRef<HTMLInputElement, EmailProps>(function Email(
  { autoComplete = "email", inputMode = "email", spellCheck = false, ...rest },
  ref,
) {
  return (
    <Text
      ref={ref}
      type="email"
      autoComplete={autoComplete}
      inputMode={inputMode}
      spellCheck={spellCheck}
      {...rest}
    />
  )
})

export default Email
export { Email }
