import type { SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

export function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="select-field"><select {...props} /><Icon name="chevron" /></span>;
}
