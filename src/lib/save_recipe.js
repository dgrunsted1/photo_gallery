import { pb } from '/src/lib/pocketbase';
import { process_recipe_old } from '/src/lib/process_recipe.js'

export async function save_recipe(e, recipe, user, new_note) {
    e.srcElement.disabled = true;
    e.srcElement.innerHTML = "validating";

    let validate_err = validate(recipe);
    if (validate_err){
        let ans = alert(`${validate_err}`);
        e.srcElement.disabled = false;
        e.srcElement.innerHTML = "save recipe";
        return;
    }
    e.srcElement.innerHTML = "uploading ingredients";

    let ingr_ids = await get_ingr_ids(recipe);
    e.srcElement.innerHTML = "uploading notes";
    let note_ids = [];
    note_ids = await get_note_ids(recipe);
    note_ids = await add_new_note(note_ids, new_note);
    e.srcElement.innerHTML = "uploading recipe";
    let data = {
        "title": recipe.title,
        "description": recipe.description,
        "author": recipe.author,
        "time": recipe.time,
        "directions": JSON.stringify(recipe.directions),
        "servings": recipe.servings,
        "image": recipe.image,
        "category": recipe.category,
        "cuisine": recipe.cuisine,
        "country": recipe.country,
        "ingr_list": ingr_ids
    };
    if (note_ids.length) data.notes = note_ids;
    if (recipe.id){
        recipe = await pb.collection('recipes').update(recipe.id, data, {expand: "notes,ingr_list"});
    }else {
        data.user = user.id;
        data.url = recipe.url;
        recipe = await pb.collection('recipes').create(data, {expand: "notes,ingr_list"});
        e.srcElement.innerHTML = "updating ingredients";
        for (let curr_ingr_id of ingr_ids){
            let update_ingr = await pb.collection('ingredients').update(curr_ingr_id, {"recipe+": recipe.id});
        }
    }
    
    
    e.srcElement.innerHTML = "saved";
    return recipe;
}

async function get_ingr_ids(recipe){
    let ingr_ids = [];
    for (let i = 0; i < recipe.expand.ingr_list.length; i++){
        if (!recipe.expand.ingr_list[i].removed){
            if (recipe.expand.ingr_list[i].id){
                const db_ingr = await pb.collection('ingredients').getOne(recipe.expand.ingr_list[i].id);
                if (db_ingr.quantity != recipe.expand.ingr_list[i].quantity || 
                    db_ingr.ingredient != recipe.expand.ingr_list[i].ingredient || 
                    db_ingr.unit != recipe.expand.ingr_list[i].unit){
                    const ingr_string = recipe.expand.ingr_list[i].quantity+ " " + recipe.expand.ingr_list[i].unit+ " " + recipe.expand.ingr_list[i].ingredient;
                    const ingr_obj = process_recipe_old(ingr_string, 'eng');
                    recipe.expand.ingr_list[i].quantity = ingr_obj.quantity;
                    recipe.expand.ingr_list[i].ingredient = ingr_obj.ingredient;
                    recipe.expand.ingr_list[i].unit = ingr_obj.unit;
                    recipe.expand.ingr_list[i].unitPlural = ingr_obj.unitPlural;
                    recipe.expand.ingr_list[i].symbol = ingr_obj.symbol;
                    if (recipe.expand.ingr_list[i].recipe.length > 1){
                        const remove_from_ingr = await pb.collection('ingredients').update(recipe.expand.ingr_list[i].id, {"recipe-": [recipe.expand.ingr_list[i].id]});
                        const new_ingr_data = {
                            "quantity": recipe.expand.ingr_list[i].quantity,
                            "ingredient": recipe.expand.ingr_list[i].ingredient,
                            "unit": recipe.expand.ingr_list[i].unit,
                            "unitPlural": recipe.expand.ingr_list[i].unitPlural,
                            "symbol": recipe.expand.ingr_list[i].symbol,
                            "recipe": [
                                recipe.id
                            ]
                        };
                        const new_ingr = await pb.collection('ingredients').create(new_ingr_data);
                        ingr_ids.push(new_ingr.id);
                    } else {
                        const update_ingr_data = {
                            "quantity": recipe.expand.ingr_list[i].quantity,
                            "ingredient": recipe.expand.ingr_list[i].ingredient,
                            "unit": recipe.expand.ingr_list[i].unit,
                            "unitPlural": recipe.expand.ingr_list[i].unitPlural,
                            "symbol": recipe.expand.ingr_list[i].symbol,
                            "recipe": [
                                recipe.id
                            ]
                        };
                        const update_ingr = await pb.collection('ingredients').update(recipe.expand.ingr_list[i].id, update_ingr_data);
                        ingr_ids.push(recipe.expand.ingr_list[i].id);
                    }
                } else {
                    ingr_ids.push(recipe.expand.ingr_list[i].id);
                }
            } else {
                const similar_ingr = await pb.collection('ingredients').getList(1, 1, { filter: `quantity='${recipe.expand.ingr_list[i].quantity}' && unit='${recipe.expand.ingr_list[i].unit}' && ingredient='${recipe.expand.ingr_list[i].ingredient}'` });
                if (similar_ingr.items.length){
                    const add_to_ingr = await pb.collection('ingredients').update(similar_ingr.items[0].id, {"recipe+": [recipe.id]});
                    ingr_ids.push(similar_ingr.items[0].id);
                }else {
                    const new_ingr_data = {
                        "quantity": recipe.expand.ingr_list[i].quantity,
                        "ingredient": recipe.expand.ingr_list[i].ingredient,
                        "unit": recipe.expand.ingr_list[i].unit,
                        "unitPlural": recipe.expand.ingr_list[i].unitPlural,
                        "symbol": recipe.expand.ingr_list[i].symbol,
                        "recipe": [
                            recipe.id
                        ]
                    };
                    const new_ingr = await pb.collection('ingredients').create(new_ingr_data);
                    ingr_ids.push(new_ingr.id);
                }
            }
        } else {
            if (recipe.expand.ingr_list[i].recipe.length > 1){
                const remove_from_ingr = await pb.collection('ingredients').update(recipe.expand.ingr_list[i].id, {"recipe-": [recipe.id]});
            } else {
                await pb.collection('ingredients').delete(recipe.expand.ingr_list[i].id);
            }
        }
    }
    return ingr_ids;    
}

async function get_note_ids(recipe){
    let note_ids = [];
    if (recipe.expand && recipe.expand.notes){
        for (let note of recipe.expand.notes){
            if (note.id){
                const note_record = await pb.collection('notes').update(note.id, { "content": note.content });
                note_ids.push(note_record.id);
            }
        }
    }

    return note_ids;
}

function validate(recipe){
    let err = "";
    if (recipe.category == "Category") err += "Please pick a category.";
    return err;
}

async function add_new_note(note_ids, note_text){
    if (note_text){
        const new_note_record = await pb.collection('notes').create({ content: note_text });
        note_ids.push(new_note_record.id);
    }
    return note_ids;
}