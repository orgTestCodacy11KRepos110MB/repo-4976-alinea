import {Collection, Cursor, Selection} from '@alinea/store'
import {Entry} from './Entry'
import {createError} from './ErrorWithCode'
import {Field} from './Field'
import {Hint} from './Hint'
import {RecordShape} from './shape/RecordShape'
import type {TypeConfig} from './Type'
import {Type} from './Type'
import {LazyRecord} from './util/LazyRecord'

export type HasType = {type: string}

type UnionOfValues<T> = T[keyof T]
type TypeToRows<T> = {[K in keyof T]: Type.Of<T[K]> & Entry}
type TypeToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {type: K}}>
  : never

export type DataOf<T> = T extends Collection<infer U> ? U : never
export type EntryOf<T> = T extends Schema<infer U> ? U : never
export type TypesOf<T> = T extends HasType ? T['type'] : string
export type ExtractType<T, K extends string> = T extends {type: K}
  ? Extract<T, {type: K}>
  : any

export namespace Schema {
  /** Utility to infer the type of a Schema, Type, Field or any Store type */
  export type TypeOf<T> = T extends Schema<infer U>
    ? U
    : T extends TypeConfig<any, infer U>
    ? U
    : T extends Type<any, infer U>
    ? U
    : T extends Field<any, any, infer Q>
    ? Q
    : T extends Selection<infer U>
    ? U
    : T extends Cursor<infer U>
    ? U
    : never
}

export class SchemaConfig<T = any> {
  shape: Record<string, RecordShape<any>>

  constructor(public types: LazyRecord<TypeConfig<any>>) {
    this.shape = Object.fromEntries(
      LazyRecord.iterate(types).map(([key, type]) => {
        return [key, type.shape]
      })
    )
  }

  configEntries() {
    return LazyRecord.iterate(this.types)
  }

  concat<X>(that: SchemaConfig<X>): SchemaConfig<T | X> {
    return schema(LazyRecord.concat(this.types, that.types)) as any
  }

  toSchema(): Schema<T> {
    return new Schema(this)
  }
}

/** Describes the different types of entries */
export class Schema<T = any> extends SchemaConfig<T> {
  typeMap = new Map<string, Type<any>>()

  constructor(config: SchemaConfig<T>) {
    super(config.types)
    for (const [name, type] of LazyRecord.iterate(config.types)) {
      if (!type.hasField('title') || !type.hasField('path'))
        throw createError(
          `Missing title or path field in type ${name}, see https://alinea.sh//docs/reference/titles`
        )
      this.typeMap.set(name, type.toType(this, name))
    }
  }

  get allTypes() {
    return Array.from(this.typeMap.values())
  }

  definitions() {
    return Hint.definitions(this.allTypes.map(type => type.hint))
  }

  entries() {
    return this.typeMap.entries()
  }

  [Symbol.iterator]() {
    return this.typeMap.entries()[Symbol.iterator]()
  }

  /** Get a type by name */
  type<K extends TypesOf<T>>(name: K): Type<Extract<T, {type: K}>> | undefined
  type(name: string): Type<any> | undefined
  type(name: any): any {
    return this.typeMap.get(name)
  }

  /** Keys of every type */
  get keys() {
    return Array.from(this.typeMap.keys())
  }

  /** A generic collection used to query any type in this schema */
  collection(): Collection<T> {
    return new Collection('Entry')
  }
}

/** Create a schema, expects a string record of Type instances */
export function schema<Types extends LazyRecord<any /* TypeConfig */>>(
  types: Types
): SchemaConfig<TypeToEntry<TypeToRows<Types>>> {
  return new SchemaConfig(types)
}
