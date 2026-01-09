We have the console where we can write sql queries or drizzle.

I wantthe drizzle experience to be as perfect as it can be, it should be detailed to the T. Almost as if a LLM is typing for you.

Current situtation

if you type: db. you'll get  
select
select
insert
insert
deleete
execute
insert
select
update...

Why this manny duplicates? It should only show the drizzle spec

If u select .select() you'll get autocompleted to this:
db.select()<-- cursor where
While you obviously want:
db.select(<-- cursor here).

Because than you would directly get the options that are avaialble for the select option.

Once you select something e.g.

db.select(incomes) it should auto go to the new option like so db.select(incomes). <--- cursor goes here, so that u get autocomplete list for the next option. Currently it only shows : from, from, from. Three times from. No clue why but this should really be perfected based on the connected database and be as good as it can. It will probably require a huge file of loads of logic but thats needed for good user expeirnece
