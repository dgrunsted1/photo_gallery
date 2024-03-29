<script>
    import { afterUpdate, onMount } from 'svelte';
    import GroceryList from "/src/lib/components/grocery_list.svelte";
    import { currentUser, pb } from '/src/lib/pocketbase';
    import { page } from '$app/stores';
    import { get_grocery_list } from '/src/lib/merge_ingredients.js';
    import { get_servings, get_total_time } from '/src/lib/recipe_util.js';
    import { createEventDispatcher } from 'svelte';



    export let title;
    export let menu;
    export let id = null;
    export let mults;
    let tab = "recipe_list";
    let grocery_list = [];
    let num_servings = 0;
    let total_time = 0;
    const dispatch = createEventDispatcher();
    let overflow_len = ``;

    onMount(async () => {
        overflow_len = ($page.url.pathname == "/menu") ? `max-h-[60vh]` : `max-h-[60vh]`;
    });

    afterUpdate(() => {
        grocery_list = [];
        num_servings = get_servings(menu, mults);
        if (!menu.length){
            if (document.getElementById('save_btn')) document.getElementById('save_btn').disabled = true;
            return;
        } else {
            if (document.getElementById('save_btn')) document.getElementById('save_btn').disabled = false;
        }
        grocery_list = get_grocery_list(menu);
        if (!menu.title) menu.title = "New Menu";
        
        
        total_time = get_total_time(menu);
    });

    function switch_tab(e){
        let siblings = e.srcElement.parentNode.children;
        for (let curr of siblings){
            if (curr != e.srcElement && curr.classList.contains("tab-active")) {
                curr.classList.remove("tab-active");
            }
        }
        e.srcElement.classList.add("tab-active");
        tab = e.srcElement.id;
    }

    async function save_menu(e){
        e.srcElement.innerHTML = '<span class="loading loading-dots loading-md mx-7"></span>';
        let recipe_ids = [];
        let made = {};
        for (let i = 0; i < menu.length; i++){
            recipe_ids.push(menu[i].id);
            made[menu[i].id] = 0;
        }
        const data = {
            "recipes": recipe_ids,
            "user": $currentUser.id,
            "today": false,
            "title": menu.title,
            "servings": mults,
            "made": made
        };
        const record = await pb.collection('menus').create(data);
        id = record.id;
        await set_todays_menu();
        e.srcElement.innerHTML = 'save menu';
        e.srcElement.disabled = true;
        window.location.href = "/today";
    }
    
    async function set_todays_menu(e){
        const resultList = await pb.collection('menus').getList(1, 1, {
            filter: `user = '${$currentUser.id}' && today = True`,
            expand: `grocery_list`
        });
        if (resultList.items.length){
            const false_record = await pb.collection('menus').update(resultList.items[0].id, { "today": false, grocery_list: null });
            if (resultList.items[0].grocery_list){
                const grocery_list_id = resultList.items[0].grocery_list;
                const grocery_list_record = await pb.collection('groceries').update(grocery_list_id, { "menu": null, active: false });
            }
        }
        const true_record = await pb.collection('menus').update(id, { "today": true });
    }

    function close_modal(){
        dispatch('close_modal');
    }

</script>

<div id="menu" class="h-3/4 md:h-full w-full">
    <div class="flex items-center p-3 justify-between">
        <input type="text" class="input input-bordered border-primary input-xs w-2/3" bind:value={title}/>
        {#if $page.url.pathname == "/menu"}
            <button class="btn btn-secondary self-end btn-xs md:btn-sm" id="save_btn" on:click={save_menu}>save menu</button>
        {:else if $page.url.pathname == "/my_menus"}
            <button class="btn btn-secondary self-end btn-xs md:btn-sm" id="today_btn" on:click={set_todays_menu}>set today</button>
        {/if}
    </div>
    <div class="flex content-center">
        <div class="tabs tabs-boxed w-fit mx-auto flex items-center bg-base-300 md:bg-base-200">
            <a id="recipe_list" class="tab tab-active tab-xs" on:click={switch_tab}>Recipes</a> 
            <a id="grocery_list" class="tab tab-xs" on:click={switch_tab}>Grocery List</a>
        </div>
    </div>
    {#if $page.url.pathname != "/menu"}
        <div class="flex justify-around m-1 items-center">
            <p class="text-xs">{menu.length} recipes</p>
            <p class="text-xs">{num_servings} servings</p>
            <p class="text-xs">{total_time}</p>
        </div>
    {/if}
    
    {#if tab == "recipe_list"}
        <div class="{overflow_len} md:max-h-[calc(100vh-210px)] overflow-y-auto">
                {#each menu as recipe}
                    <div class="img_serv_container card card-bordered card-side flex flex-row w-auto items-center my-3.5 mx-3 shadow-xl h-fit md:h-52 bg-base-300 md:bg-base-200">
                        <figure class="image w-1/3 h-full">
                            <img class="h-full" src={recipe.image} alt={recipe.title}/>
                        </figure>
                        <div class="servings_time_container w-2/3 ml-2.5">
                            <p class="title text-xs bold md:text-xl">{recipe.title}</p>
                            <p class="time text-xs">{recipe.time}</p>
                            <div class="servings_container text-xs">
                                servings:<input type="text" class="servings input input-bordered input-xs px-1 mr-1 w-8" id={recipe.id} bind:value={mults[recipe.id]}>
                            </div>
                            <p class="description text-xs">{recipe.description}</p>
                        </div>
                    </div>
                {/each}
        </div>
    {:else if tab == "grocery_list"}
        <GroceryList status="none" {grocery_list}/>
    {/if}
</div>