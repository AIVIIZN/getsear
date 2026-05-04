import * as React from "react"
import { Text, type TextProps } from "./Text"

export type NumberInputProps = Omit<TextProps, "type">

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ inputMode = "decimal", ...rest }, ref) {
    return <Text ref={ref} type="number" inputMode={inputMode} {...rest} />
  },
)

export default NumberInput
export { NumberInput }
