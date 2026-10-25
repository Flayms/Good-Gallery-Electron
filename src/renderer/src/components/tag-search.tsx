import { normalizeTag } from '@shared/tags'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Command as CommandPrimitive } from 'cmdk'
import { cn } from 'cn'
import { FileIcon, FileSearchIcon, MinusIcon, PlusIcon, SearchIcon, TagIcon, XIcon } from 'lucide-react'
import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { CommandEmpty, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { type GallerySearch, type TagMode, withoutTag, withTag } from '@/lib/search'
import { trpc } from '@/lib/trpc'

const SUGGESTIONS = 10
/** cmdk value of the file name item; tag items use their numeric id. */
const FILE_NAME_VALUE = 'file-name'

interface TagSearchProps {
  search: GallerySearch
  onSearchChange: (patch: Partial<GallerySearch>) => void
  className?: string
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="rounded-full p-0.5 hover:bg-foreground/10" onClick={onRemove} aria-label={label}>
      <XIcon className="size-3" />
    </button>
  )
}

function FileNameChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Badge variant="outline" className="h-6 gap-1 pr-0.5" title="File name contains">
      <FileIcon className="size-3" />
      <span>{name}</span>
      <RemoveButton label={`Remove file name filter ${name}`} onRemove={onRemove} />
    </Badge>
  )
}

function TagChip({
  name,
  mode,
  onToggle,
  onRemove,
}: {
  name: string
  mode: TagMode
  onToggle: () => void
  onRemove: () => void
}) {
  const excluded = mode === 'exclude'
  return (
    <Badge variant={excluded ? 'destructive' : 'secondary'} className="h-6 gap-0.5 pr-0.5">
      <button
        type="button"
        className="flex items-center gap-1"
        onClick={onToggle}
        title={excluded ? 'Excluded – click to include' : 'Included – click to exclude'}
      >
        {excluded ? <MinusIcon className="size-3" /> : <TagIcon className="size-3" />}
        <span className={cn(excluded && 'line-through')}>{name}</span>
      </button>
      <RemoveButton label={`Remove ${name}`} onRemove={onRemove} />
    </Badge>
  )
}

/**
 * Tag and file name filter: chips for the selected tags (and file name text) and an autocomplete input;
 * a leading `-` adds a tag exclusion.
 */
export function TagSearch({ search, onSearchChange, className }: TagSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const mode: TagMode = query.startsWith('-') ? 'exclude' : 'include'
  const prefix = mode === 'exclude' ? query.slice(1) : query

  const selected = [
    ...(search.tags ?? []).map((name) => ({ name, mode: 'include' as const })),
    ...(search.exclude ?? []).map((name) => ({ name, mode: 'exclude' as const })),
  ]
  // Selected tags stay in the list, so ask for enough extra to still fill it.
  const suggestions = useQuery(
    trpc.tags.autocomplete.queryOptions(
      { prefix, limit: SUGGESTIONS + selected.length },
      { enabled: open, placeholderData: keepPreviousData },
    ),
  )
  const selectedNames = new Set(selected.map((tag) => normalizeTag(tag.name)))
  const options = (suggestions.data ?? [])
    .filter((tag) => !selectedNames.has(normalizeTag(tag.name)))
    .slice(0, SUGGESTIONS)
  // Exclusions only exist for tags.
  const fileName = mode === 'include' ? query.trim() : ''
  const values = [...options.map((tag) => String(tag.id)), ...(fileName ? [FILE_NAME_VALUE] : [])]
  // cmdk only highlights the first item when the query changes, before the new suggestions arrive.
  const [highlighted, setHighlighted] = useState('')
  const highlightedValue = values.includes(highlighted) ? highlighted : (values[0] ?? '')

  const add = (name: string) => {
    onSearchChange(withTag(search, name, mode))
    setQuery('')
  }

  const addFileName = () => {
    onSearchChange({ name: fileName })
    setQuery('')
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const last = selected.at(-1)
    if (event.key === 'Backspace' && query === '' && search.name) {
      onSearchChange({ name: undefined })
    } else if (event.key === 'Backspace' && query === '' && last) {
      onSearchChange(withoutTag(search, last.name))
    } else if (event.key === 'Escape') {
      if (query) setQuery('')
      else inputRef.current?.blur()
    }
  }

  return (
    <CommandPrimitive
      shouldFilter={false}
      loop
      value={highlightedValue}
      onValueChange={setHighlighted}
      className={cn('min-w-32 max-w-xl flex-1', className)}
      onKeyDown={onKeyDown}
    >
      {/* The suggestions open in a portal: inside the glass toolbar they could only blur the toolbar itself. */}
      <Popover open={open}>
        <PopoverAnchor asChild>
          {/* A label, so clicks on the padding focus the input; `htmlFor`, since the chip buttons are labelable too. */}
          <label
            htmlFor={inputId}
            className="flex h-8 cursor-text items-center gap-1 overflow-x-auto rounded-md border border-transparent bg-field px-2 [scrollbar-width:none] focus-within:border-ring"
          >
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            {selected.map((tag) => (
              <TagChip
                key={`${tag.mode}:${tag.name}`}
                name={tag.name}
                mode={tag.mode}
                onToggle={() =>
                  onSearchChange(withTag(search, tag.name, tag.mode === 'include' ? 'exclude' : 'include'))
                }
                onRemove={() => onSearchChange(withoutTag(search, tag.name))}
              />
            ))}
            {search.name && <FileNameChip name={search.name} onRemove={() => onSearchChange({ name: undefined })} />}
            <CommandPrimitive.Input
              id={inputId}
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              placeholder={selected.length === 0 && !search.name ? 'Search tags or file names' : undefined}
              aria-label="Search tags or file names"
              className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 gap-1 p-1"
          // Focus stays in the input; it decides when the suggestions close.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          // Keeps focus in the input while clicking a suggestion.
          onMouseDown={(event) => event.preventDefault()}
        >
          <CommandList>
            {!suggestions.isPending && <CommandEmpty>No matching tags</CommandEmpty>}
            {options.map((tag) => (
              <CommandItem key={tag.id} value={String(tag.id)} onSelect={() => add(tag.name)}>
                {mode === 'exclude' ? <MinusIcon className="text-destructive" /> : <PlusIcon />}
                <span className="truncate">{tag.name}</span>
                <CommandShortcut className="tracking-normal tabular-nums">{tag.count.toLocaleString()}</CommandShortcut>
              </CommandItem>
            ))}
            {fileName && (
              <CommandItem value={FILE_NAME_VALUE} onSelect={addFileName}>
                <FileSearchIcon />
                <span className="truncate">File name contains “{fileName}”</span>
              </CommandItem>
            )}
          </CommandList>
          <p className="px-2 pt-1 pb-1.5 text-muted-foreground text-xs">Start with - to exclude a tag</p>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  )
}
